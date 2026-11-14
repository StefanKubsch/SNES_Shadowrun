import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findEdge, withStartPage } from './browser-frame.mjs';

const edge = findEdge();
const waitFor = (condition) => `new Promise((resolve,reject)=>{
  const end=Date.now()+30000;const check=()=>{
    const error=document.querySelector('#screen')?.dataset.error;
    if(error)reject(Error(error));else if(${condition})resolve(true);
    else if(Date.now()>end)reject(Error('Condition timed out'));else setTimeout(check,25);
  };check();})`;

test(
  'Cheats is bilingual, modal, fullscreen and narrow-screen safe; shared worker records switches',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 150000 },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 40000 }, async ({ cdp, evalJs, logDir }) => {
      const click = (id) => evalJs(`document.querySelector('${id}').click()`);
      const recordedMask = (mask) =>
        evalJs(`new Promise((resolve,reject)=>{
        const end=Date.now()+30000;const check=()=>{
          if(globalThis.cheatRecording?.events.some(e=>e[1]==='cheats-${mask}'))resolve(true);
          else if(Date.now()>end)reject(Error('Cheat mask ${mask} not recorded'));
          else {cheatWorker.postMessage({command:'recording'});setTimeout(check,150);}
        };check();})`);
      const press = async (code, key = code) => {
        await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', code, key });
        await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', code, key });
      };
      await evalJs(waitFor("document.querySelector('#screen').dataset.stage==='data'"));
      await click('#menu-toggle');
      assert.equal(
        await evalJs("document.querySelector('#cheats-open').getAttribute('aria-haspopup')"),
        'dialog',
      );
      await click('#cheats-open');
      assert.deepEqual(
        await evalJs(`(()=>{const d=document.querySelector('#cheats');return {
        open:d.open,lang:d.lang,focus:document.activeElement.id,
        modal:d.matches(':modal'),off:d.querySelectorAll('[aria-pressed=false]').length,
        parent:d.parentElement.id,menuHidden:document.querySelector('#menu').hidden};})()`),
        {
          open: true,
          lang: 'en',
          focus: 'cheats-close',
          modal: true,
          off: 4,
          parent: 'frame',
          menuHidden: true,
        },
      );
      for (const name of ['health', 'money', 'stats', 'spells']) await click('#cheat-' + name);
      // Real keyboard activation must stay in the dialog and keep focus on its switch.
      await evalJs("document.querySelector('#cheat-health').focus()");
      await press('Space', ' ');
      assert.equal(
        await evalJs("document.querySelector('#cheat-health').getAttribute('aria-pressed')"),
        'false',
      );
      await press('Space', ' ');
      await press('Escape');
      await evalJs(
        waitFor(
          "!document.querySelector('#cheats').open&&document.activeElement.id==='menu-toggle'",
        ),
      );
      await click('#menu-toggle');
      await click('#language');
      await evalJs(waitFor("document.querySelector('#cheats').lang==='de'"));
      await click('#cheats-open');
      assert.match(
        await evalJs("document.querySelector('#cheat-health').textContent"),
        /Lebenspunkte.*Ein/,
      );
      await cdp.call('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 720,
        deviceScaleFactor: 1,
        mobile: false,
      });
      assert.equal(
        await evalJs(`(()=>{const d=document.querySelector('#cheats'),b=d.getBoundingClientRect();
        return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth;})()`),
        true,
      );
      const shot = await cdp.call('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(logDir, 'cheats-narrow.png'), Buffer.from(shot.data, 'base64'));
      await click('#cheats-close');
      await cdp.call('Emulation.clearDeviceMetricsOverride');
      await click('#menu-toggle');
      await click('#fullscreen');
      await evalJs(
        waitFor("!!document.fullscreenElement&&!!document.querySelector('#frame').dataset.escape"),
      );
      await click('#menu-toggle');
      await click('#cheats-open');
      assert.equal(
        await evalJs("document.fullscreenElement.contains(document.querySelector('#cheats'))"),
        true,
      );
      await press('Escape');
      await evalJs(waitFor("!document.querySelector('#cheats').open"));
      assert.equal(await evalJs('!!document.fullscreenElement'), true);
      await evalJs('document.exitFullscreen()');
      await evalJs(`(()=>{const Original=globalThis.Worker;globalThis.Worker=class extends Original{
        constructor(...args){super(...args);globalThis.cheatWorker=this;
          this.addEventListener('message',({data})=>{if(data.recording)globalThis.cheatRecording=JSON.parse(data.recording);});}
      };document.querySelector('#start').click();})()`);
      await evalJs(waitFor("document.querySelector('#screen').dataset.ready==='true'"));
      assert.equal(await evalJs("document.querySelector('#screen').dataset.shared"), 'true');
      await recordedMask(15);
      await click('#menu-toggle');
      await click('#cheats-open');
      const before = await evalJs("document.querySelector('#screen').dataset.nmi");
      await press('KeyW', 'w');
      await press('KeyP', 'p');
      await new Promise((resolve) => setTimeout(resolve, 160));
      assert.equal(await evalJs("document.querySelector('#screen').dataset.nmi"), before);
      assert.equal(await evalJs("document.querySelector('#screen').dataset.pad"), '0');
      assert.equal(await evalJs("document.querySelector('#screen').dataset.paused"), 'true');
      await click('#cheat-money');
      await click('#cheat-spells');
      await click('#cheats-close');
      await evalJs(
        waitFor(`document.querySelector('#screen').dataset.nmi!==${JSON.stringify(before)}`),
      );
      await recordedMask(5);
      await press('KeyP', 'p');
      await click('#menu-toggle');
      await click('#cheats-open');
      await click('#cheats-close');
      assert.equal(
        await evalJs("document.querySelector('#screen').dataset.paused"),
        'true',
        'P pause survives closing',
      );
      await press('KeyP', 'p');
      await click('#recording-export');
      await evalJs(waitFor('!!globalThis.cheatRecording'));
      assert.deepEqual(
        await evalJs("cheatRecording.events.filter(e=>e[1].startsWith('cheats-')).map(e=>e[1])"),
        ['cheats-15', 'cheats-5'],
      );
      console.log(JSON.stringify({ logDir }));
    });
  },
);
