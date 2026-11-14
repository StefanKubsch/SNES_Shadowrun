import { spawn } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { browserServer } from './serve-browser.mjs';
import { removeDirQuietly } from './temp-dir.mjs';
const DEFAULT_COMMAND_TIMEOUT_MS = 150000,
  DEBUGGER_WAIT_MS = 30000,
  PAGE_POLL_MS = 100,
  PAGE_GUARD_MS = 500;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function findEdge() {
  return (
    [process.env['ProgramFiles(x86)'], process.env.ProgramFiles]
      .filter(Boolean)
      .map((p) => join(p, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
      .find(existsSync) ?? null
  );
}
async function connect(url, commandTimeout) {
  const socket = new WebSocket(url),
    pending = new Map();
  let sequence = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data),
      p = pending.get(data.id);
    if (p) {
      pending.delete(data.id);
      if (data.error) p.reject(Error(JSON.stringify(data.error)));
      else p.resolve(data.result);
    }
  });
  return {
    call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(Error('Browser command timed out: ' + method));
        }, commandTimeout);
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}
// Edge headless on the local start page (served like npm start, with cross-origin
// isolation). use({cdp,evalJs,logDir}) runs once the page is loaded; the browser
// closes afterwards and its log stays in logDir. commandTimeout limits each
// browser command; keep it below the test timeout so a hang names its command.
export async function withStartPage(
  { root = process.cwd(), exe = findEdge(), commandTimeout = DEFAULT_COMMAND_TIMEOUT_MS } = {},
  use,
) {
  assert.ok(exe, 'Microsoft Edge required for the actual browser');
  const logDir = await mkdtemp(join(tmpdir(), 'snes-browser-frame-')),
    server = browserServer(root);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  // Exports (recording, save) are links the tests click; with a fresh profile
  // the headless browser would save them in the user's Downloads folder. The
  // profile's preferences send them to logDir/downloads, where they stay with the log.
  const downloads = join(logDir, 'downloads');
  await mkdir(join(logDir, 'profile', 'Default'), { recursive: true });
  await mkdir(downloads, { recursive: true });
  await writeFile(
    join(logDir, 'profile', 'Default', 'Preferences'),
    JSON.stringify({
      download: { default_directory: downloads, prompt_for_download: false },
      savefile: { default_directory: downloads },
    }),
  );
  const child = spawn(
    exe,
    [
      '--headless=new',
      '--autoplay-policy=no-user-gesture-required',
      // Keep the real audio graph running without mixing test sound into a
      // user's game on the host's speakers. PCM and playback clocks still run.
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      // Hardware rendering by default, as players see it; SNES_BROWSER_GPU=0
      // selects the software renderer, such as in a sandbox without GPU access.
      ...(process.env.SNES_BROWSER_GPU === '0' ? ['--disable-gpu'] : []),
      '--remote-debugging-port=0',
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${join(logDir, 'profile')}`,
      '--window-size=1100,1000',
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  let cdp, guard;
  try {
    let port;
    const deadline = Date.now() + DEBUGGER_WAIT_MS;
    while (Date.now() < deadline) {
      try {
        port = Number(
          (await readFile(join(logDir, 'profile', 'DevToolsActivePort'), 'utf8')).split('\n')[0],
        );
        break;
      } catch {
        await delay(PAGE_POLL_MS);
      }
    }
    assert.ok(port, 'browser debugging port missing');
    const created = await (
        await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
      ).json(),
      page = created;
    assert.ok(page.webSocketDebuggerUrl);
    cdp = await connect(page.webSocketDebuggerUrl, commandTimeout);
    await cdp.call('Page.enable');
    const url = `http://127.0.0.1:${server.address().port}/`;
    await cdp.call('Page.navigate', { url });
    // Edge may move the requested URL to another target while opening its own
    // account setup dialog. Bind to our exact local URL, never that dialog.
    let active;
    const targetDeadline = Date.now() + DEBUGGER_WAIT_MS;
    while (Date.now() < targetDeadline) {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      active = pages.find((p) => p.type === 'page' && p.url === url);
      if (active) break;
      await delay(PAGE_POLL_MS);
    }
    assert.ok(active, 'local browser page missing');
    if (active.id !== page.id) {
      cdp.close();
      cdp = await connect(active.webSocketDebuggerUrl, commandTimeout);
      await cdp.call('Page.enable');
    }
    await cdp.call('Page.bringToFront');
    // A page Edge opens later (such as its account setup) would hide ours:
    // a hidden page gets no animation frames, and a test waiting for one
    // hangs. Close such pages, bring ours back and note each in logDir.
    const ownId = active.id;
    guard = setInterval(async () => {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const foreign = pages.filter((p) => p.type === 'page' && p.id !== ownId);
        if (!foreign.length) return;
        for (const p of foreign) await fetch(`http://127.0.0.1:${port}/json/close/${p.id}`);
        await appendFile(
          join(logDir, 'foreign-pages.txt'),
          foreign.map((p) => p.url + '\n').join(''),
        );
        await cdp.call('Page.bringToFront');
      } catch {
        // The browser may be closing; the next tick or the test reports it.
      }
    }, PAGE_GUARD_MS);
    const evalJs = async (expression) => {
      const result = await cdp.call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await evalJs(
      `new Promise((resolve,reject)=>{const stop=Date.now()+30000;const check=()=>{if(document.readyState==='complete'&&document.querySelector('#start'))resolve(true);else if(Date.now()>stop)reject(Error('Start button missing'));else setTimeout(check,50)};check();})`,
    );
    return await use({ cdp, evalJs, logDir });
  } finally {
    clearInterval(guard);
    if (cdp) {
      try {
        await cdp.call('Browser.close');
      } catch {
        // The browser can already have exited after a test failure.
      }
      cdp.close();
    }
    child.kill();
    child.stderr.destroy();
    child.unref();
    server.closeAllConnections();
    server.close();
    await writeFile(join(logDir, 'browser.log'), stderr);
    // The Edge profile (about 1000 files per run) is not a log; the log,
    // foreign-page notes and downloads stay in logDir.
    await removeDirQuietly(join(logDir, 'profile'));
  }
}
// The real start page in Edge: it loads the game data package (no ROM), "Start game" (live cold start
// in the worker, src/browser/game-worker.mjs), let it run with key held (or no
// key) to live NMI minNmi, pause with P and read canvas, NMI and sound in one turn.
// savePath imports a .srm before the start (src/browser/save-file.mjs); the
// result then reports the stored text, the exported file and the SRAM hash the worker started with.
export async function browserLive({
  root = process.cwd(),
  exe = findEdge(),
  key = null,
  minNmi,
  savePath = null,
} = {}) {
  return withStartPage({ root, exe }, async ({ cdp, evalJs, logDir }) => {
    const until = (condition, what) =>
      evalJs(
        `new Promise((resolve,reject)=>{const stop=Date.now()+120000;const check=()=>{const c=document.querySelector('#screen');if(c.dataset.error)reject(Error(c.dataset.error));else if(${condition})resolve(true);else if(Date.now()>stop)reject(Error('${what} timed out'));else setTimeout(check,50)};check();})`,
      );
    const doc = await cdp.call('DOM.getDocument');
    // The page loads the data package itself (no ROM); reading it here records it as an input for the release cache.
    const samples = (await readdir(resolve(root, 'assets', 'vm-samples')))
      .filter((n) => /^[0-9A-F]{6}\.wav$/.test(n))
      .map((n) => 'vm-samples/' + n);
    for (const name of [
      'scripts.json',
      ...(await readdir(resolve(root, 'assets'))).filter((n) =>
        /^vm-[a-z0-9-]+\.(json|bin|bmp)$/.test(n),
      ),
      ...samples,
    ])
      await readFile(resolve(root, 'assets', name));
    await until(`c.dataset.stage==='data'&&!document.querySelector('#start').hidden`, 'Game data');
    if (savePath) {
      await readFile(savePath);
      const saveInput = await cdp.call('DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector: '#save-file',
      });
      await cdp.call('DOM.setFileInputFiles', { nodeId: saveInput.nodeId, files: [savePath] });
      await until(`c.dataset.saveHash`, 'Save import');
    }
    // Hold the key before the first live frame, so every frame k has the same pad word.
    await evalJs(
      `${key ? `dispatchEvent(new KeyboardEvent('keydown',{code:'${key}'}));` : ''}document.querySelector('#start').click()`,
    );
    await until(`Number(c.dataset.nmi)>=${minNmi}&&c.dataset.ready==='true'`, 'Live frames');
    await evalJs(
      `dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP'}));new Promise(resolve=>setTimeout(resolve,500))`,
    );
    const shot = await evalJs(
      `(()=>{const c=document.querySelector('#screen'),p=c.crt.source();let s='';for(let i=0;i<p.length;i++)s+=String.fromCharCode(p[i]);const d=c.dataset;return {nmi:Number(d.nmi),paused:d.paused,shared:d.shared,stalls:Number(d.stalls??0),rgba:btoa(s),audio:{pairs:Number(d.audioPairs),hash:Number(d.audioHash),played:Number(d.audioPlayed??0),silent:Number(d.audioSilent??0),dropped:Number(d.audioDropped??0),state:d.audioState??null,error:d.audioError??null}};})()`,
    );
    const later = await evalJs(
      `new Promise(resolve=>setTimeout(()=>resolve(Number(document.querySelector('#screen').dataset.nmi)),300))`,
    );
    assert.equal(shot.paused, 'true');
    assert.equal(later, shot.nmi, 'paused live mode stays on its frame');
    // Pad word of the page after the pause (takes effect on resuming): Y on QWERTZ (code KeyZ), right mouse button on the game picture.
    const pads =
      await evalJs(`(()=>{const c=document.querySelector('#screen'),read=()=>Number(c.dataset.pad);const out=[];
    dispatchEvent(new KeyboardEvent('keydown',{code:'KeyZ',key:'y'}));out.push(read());
    c.dispatchEvent(new PointerEvent('pointerdown',{button:2,bubbles:true}));out.push(read());
    dispatchEvent(new PointerEvent('pointerup',{button:2}));dispatchEvent(new KeyboardEvent('keyup',{code:'KeyZ',key:'y'}));out.push(read());
    return out;})()`);
    // Export: the download link's blob, caught at URL.createObjectURL.
    const save = savePath
      ? await evalJs(`new Promise(resolve=>{const create=URL.createObjectURL;URL.createObjectURL=blob=>{URL.createObjectURL=create;
    blob.arrayBuffer().then(b=>{let s='';for(const v of new Uint8Array(b))s+=String.fromCharCode(v);const d=document.querySelector('#screen').dataset;
      resolve({stored:localStorage.getItem('shadowrun.sram.1'),exported:btoa(s),hash:Number(d.saveHash),loaded:Number(d.saveLoaded),status:document.querySelector('#save-status').textContent});});
    return create(blob);};document.querySelector('#save-export').click();})`)
      : null;
    const bytes = Buffer.from(shot.rgba, 'base64');
    await writeFile(join(logDir, 'live.rgba'), bytes);
    const screenshot = await cdp.call('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(join(logDir, 'live.png'), Buffer.from(screenshot.data, 'base64'));
    return {
      nmi: shot.nmi,
      pixels: bytes,
      audio: shot.audio,
      shared: shot.shared === 'true',
      stalls: shot.stalls,
      pads,
      save,
      logDir,
    };
  });
}
