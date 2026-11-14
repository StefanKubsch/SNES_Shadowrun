// Reproducible CRT service-time measurement, separate from the game and tests.
// Run: npm run benchmark:crt -- [samples per case, default 40]
// Hardware acceleration is requested; the actual backend is recorded, never assumed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findEdge } from './browser-frame.mjs';
import { browserServer } from './serve-browser.mjs';
import { removeDirQuietly } from './temp-dir.mjs';

const samples = Number(process.argv[2] ?? 40);
assert.ok(Number.isInteger(samples) && samples >= 5 && samples <= 1000, 'Use 5..1000 samples');
const executable = findEdge();
assert.ok(executable, 'Microsoft Edge is required');
const logDir = await mkdtemp(join(tmpdir(), 'snes-crt-benchmark-'));
const server = browserServer();
// Serve an empty page so no game, audio, workers or second CRT compete for time.
const serveFile = server.listeners('request')[0];
server.removeAllListeners('request');
server.on('request', (request, response) => {
  if (request.url !== '/') return serveFile(request, response);
  response.writeHead(200, {
    'Content-Type': 'text/html',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  });
  response.end('<!doctype html><title>CRT benchmark</title>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const child = spawn(
  executable,
  [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${join(logDir, 'profile')}`,
    '--window-size=1600,1200',
    'about:blank',
  ],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
);
let browserLog = '';
child.stderr.on('data', (chunk) => (browserLog += chunk));
child.on('error', (error) => (browserLog += error.stack));
let connection;
try {
  const portFile = join(logDir, 'profile', 'DevToolsActivePort');
  const deadline = Date.now() + 30_000;
  let endpoint;
  while (Date.now() < deadline) {
    try {
      const [port, path] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/);
      endpoint = `ws://127.0.0.1:${Number(port)}${path}`;
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(endpoint, `Edge debugging endpoint missing; logs: ${logDir}`);
  connection = await connect(endpoint);
  const version = await connection.call('Browser.getVersion');
  const { gpu } = await connection.call('SystemInfo.getInfo');
  const { targetId } = await connection.call('Target.createTarget', {
    url: `http://127.0.0.1:${server.address().port}/`,
  });
  const { sessionId } = await connection.call('Target.attachToTarget', { targetId, flatten: true });
  let ready = false;
  while (Date.now() < deadline) {
    const state = await connection.call(
      'Runtime.evaluate',
      { expression: "location.origin !== 'null' && document.readyState === 'complete'" },
      sessionId,
    );
    if (state.result.value) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(ready, 'Benchmark page did not load');
  const measured = await connection.call(
    'Runtime.evaluate',
    {
      expression: `(${measure.toString()})(${samples})`,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  assert.ok(!measured.exceptionDetails, JSON.stringify(measured.exceptionDetails));
  const result = {
    date: new Date().toISOString(),
    browser: version.product,
    gpu,
    ...measured.result.value,
    logDir,
  };
  await writeFile(join(logDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (connection) {
    try {
      await connection.call('Browser.close');
    } catch {
      // Edge can close the socket before acknowledging Browser.close.
    }
    connection.close();
  }
  child.kill();
  child.stderr.destroy();
  child.unref();
  server.closeAllConnections();
  server.close();
  await writeFile(join(logDir, 'browser.log'), browserLog);
  // Keep the result and log, not the Edge profile.
  await removeDirQuietly(join(logDir, 'profile'));
}

async function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const pending = new Map();
  let sequence = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(Error('Edge debugging connection closed'));
    }
    pending.clear();
  });
  return {
    call(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(Error(`Edge command timed out: ${method}; logs: ${logDir}`));
        }, 150_000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
    close: () => socket.close(),
  };
}

// Executed in the isolated benchmark page, with no Node dependencies.
async function measure(samples) {
  const WARMUP_MS = 2000;
  const { createCrt } = await import('/src/crt/crt.mjs');
  const { SNES_PAL_RGB: source, SONY_PVM_20M2E: monitor } = await import('/src/crt/profiles.mjs');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:1440px;height:1080px';
  document.body.append(canvas);
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
  });
  if (!gl) throw Error('WebGL2 is unavailable');
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  const softwareBackend = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const probe = new Uint8Array(4);
  const textures = [];
  const allocate = gl.texStorage2D.bind(gl);
  gl.texStorage2D = (target, levels, format, width, height) => {
    const bytesPerTexel = format === gl.RGBA16F ? 8 : format === gl.RGBA8 ? 4 : null;
    if (levels !== 1 || bytesPerTexel === null) throw Error('Unaccounted texture format');
    textures.push({
      format: format === gl.RGBA16F ? 'RGBA16F' : 'RGBA8',
      width,
      height,
      bytes: width * height * bytesPerTexel,
    });
    return allocate(target, levels, format, width, height);
  };
  const crt = createCrt(canvas, { source, monitor, output: 'srgb' });
  if (!crt.available) throw Error('Float-target CRT is unavailable');
  const pixels = new Uint8ClampedArray(source.width * source.height * 4);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      pixels.set([x, y, (x * 7 + y * 13) & 255, 255], (y * source.width + x) * 4);
    }
  }
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const cases = [];
  const summary = (values) => {
    const sorted = values.toSorted((a, b) => a - b);
    return {
      median:
        (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2,
      p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
      min: sorted[0],
      max: sorted.at(-1),
    };
  };
  try {
    for (const [width, height] of [
      [1440, 1080],
      [2880, 2160],
    ]) {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      await nextFrame();
      await nextFrame();
      if (canvas.width !== width || canvas.height !== height) throw Error('Canvas sizing mismatch');
      for (const enabled of [false, true]) {
        crt.setEnabled(enabled);
        // A few frames are not enough: the GPU starts in a low clock state and
        // the first case measured several times its warm service time.
        const warm = performance.now() + WARMUP_MS;
        while (performance.now() < warm) {
          crt.draw(pixels);
          gl.finish();
        }
        const submissionMs = [],
          completedWithReadbackMs = [],
          queries = [];
        if (timer) gl.getParameter(timer.GPU_DISJOINT_EXT);
        for (let i = 0; i < samples; i++) {
          pixels[0] = (i * 8) & 255;
          const query = timer ? gl.createQuery() : null;
          if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
          const start = performance.now();
          crt.draw(pixels);
          const submitted = performance.now();
          if (query) gl.endQuery(timer.TIME_ELAPSED_EXT);
          // A synchronous one-pixel readback establishes completion. Its cost
          // belongs to this diagnostic metric, not to the production renderer.
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probe);
          completedWithReadbackMs.push(performance.now() - start);
          submissionMs.push(submitted - start);
          if (query) queries.push(query);
        }
        // Query results become observable only after returning to the browser.
        const deadline = performance.now() + 10_000;
        let disjoint = false;
        while (queries.some((query) => !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE))) {
          if (gl.getParameter(timer.GPU_DISJOINT_EXT)) {
            disjoint = true;
            break;
          }
          if (performance.now() > deadline) throw Error('GPU timer queries timed out');
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        if (timer) disjoint ||= gl.getParameter(timer.GPU_DISJOINT_EXT);
        const gpuMs = disjoint
          ? []
          : queries.map((query) => gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        for (const query of queries) gl.deleteQuery(query);
        const error = gl.getError();
        if (gl.isContextLost() || error !== gl.NO_ERROR) throw Error(`WebGL error ${error}`);
        cases.push({
          width,
          height,
          enabled,
          samples,
          submissionMs: summary(submissionMs),
          completedWithReadbackMs: summary(completedWithReadbackMs),
          gpuMs: gpuMs.length ? summary(gpuMs) : null,
          gpuTimerDisjoint: disjoint,
          estimatedSingleRgba8OutputBytes: width * height * 4,
        });
      }
    }
    return {
      renderer,
      softwareBackend,
      gpuTimerAvailable: !!timer,
      warmupMs: WARMUP_MS,
      sourceBytes: pixels.byteLength,
      textures,
      textureBytes: textures.reduce((sum, texture) => sum + texture.bytes, 0),
      cases,
    };
  } finally {
    crt.destroy();
    canvas.remove();
  }
}
