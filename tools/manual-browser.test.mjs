import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findEdge, withStartPage } from './browser-frame.mjs';

const edge = findEdge();
const waitFor = (condition) => `new Promise((resolve,reject)=>{
  const end=Date.now()+30000;const check=()=>{
    if(document.querySelector('#screen')?.dataset.error)reject(Error(document.querySelector('#screen').dataset.error));
    else if((${condition})())resolve(true);else if(Date.now()>end)reject(Error('Condition timed out: '+${JSON.stringify(condition)}));
    else setTimeout(check,25);
  };check();})`;

test(
  'handbook follows the stored language, works in fullscreen and isolates a live game',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 150000 },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 40000 }, async ({ cdp, evalJs, logDir }) => {
      const click = async (selector) => {
        const box = await evalJs(
          `(async()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest',inline:'nearest'});
          // Wait for the compositor to apply scrolling before dispatching a real click.
          await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
          const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()`,
        );
        await cdp.call('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          ...box,
          button: 'left',
          clickCount: 1,
        });
        await cdp.call('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          ...box,
          button: 'left',
          clickCount: 1,
        });
      };
      const press = async (code, key = code) => {
        await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', code, key });
        await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', code, key });
      };
      const close = async () => {
        await click('#manual-close');
        await evalJs(
          waitFor(
            "()=>!document.querySelector('#manual').open&&document.activeElement.id==='menu-toggle'",
          ),
        );
      };
      await evalJs(waitFor("()=>document.querySelector('#manual-open')?.textContent==='Handbook'"));
      assert.equal(
        await evalJs("document.querySelector('#menu-actions').firstElementChild.id"),
        'language',
      );
      assert.equal(
        await evalJs("document.querySelector('#language').textContent"),
        'Language: English',
      );
      await click('#menu-toggle');
      assert.equal(
        await evalJs("document.querySelector('[data-control=A] strong').textContent"),
        'Aim / Shoot',
      );
      await click('#manual-open');
      assert.equal(await evalJs("document.querySelector('#manual').lang"), 'en');
      assert.match(
        await evalJs("document.querySelector('#manual').innerText"),
        /Required Strength/,
      );
      const navigation =
        await evalJs(`(()=>{const nav=[...document.querySelectorAll('#manual nav button')].map(n=>n.getBoundingClientRect());
        const content=document.querySelector('.manual-scroll').getBoundingClientRect();
        return nav.every((b,i)=>b.right<=content.left&&b.left===nav[0].left&&(!i||b.top>=nav[i-1].bottom));})()`);
      assert.equal(
        navigation,
        true,
        'chapters form a vertical sidebar to the left of the contents',
      );
      assert.doesNotMatch(
        await evalJs("document.querySelector('#manual').innerText"),
        /US manual|PDF page|printed manual/,
      );
      assert.equal(await evalJs("document.querySelectorAll('#manual .manual-source').length"), 0);
      const activeChapter =
        "document.querySelector('#manual nav [aria-current=location]')?.dataset.chapter";
      assert.equal(await evalJs(activeChapter), 'all');
      for (const chapter of [
        'getting-started',
        'controls',
        'equipment',
        'magic',
        'matrix',
        'controls',
        'all',
      ]) {
        await evalJs(
          `document.querySelector('.manual-content > [data-chapter="${chapter}"]').scrollIntoView({block:'start'})`,
        );
        await evalJs(waitFor(`()=>${activeChapter}===${JSON.stringify(chapter)}`));
        assert.equal(
          await evalJs('document.activeElement.id'),
          'manual-close',
          'scrolling updates the highlight without moving focus',
        );
        assert.equal(
          await evalJs(`(()=>{const active=document.querySelector('#manual nav [aria-current=location]').getBoundingClientRect();
          const nav=document.querySelector('#manual nav').getBoundingClientRect();return active.top>=nav.top-1&&active.bottom<=nav.bottom+1;})()`),
          true,
          'the active chapter remains visible in the long sidebar',
        );
      }
      await click('#manual nav [data-chapter="magic"]');
      assert.equal(await evalJs(activeChapter), 'magic');
      assert.equal(
        await evalJs("document.querySelectorAll('.manual-content > section[data-chapter]').length"),
        14,
        'chapter clicks keep the full guide scrollable',
      );
      await click('#manual nav [data-chapter="all"]');
      assert.equal(await evalJs(activeChapter), 'all');
      assert.equal(
        await evalJs("document.querySelector('#manual').contains(document.activeElement)"),
        true,
      );
      await close();

      await click('#menu-toggle');
      await click('#language');
      await evalJs(waitFor("()=>document.querySelector('#manual-open').textContent==='Handbuch'"));
      assert.equal(
        await evalJs("document.querySelector('#language').textContent"),
        'Sprache: Deutsch',
      );
      assert.deepEqual(
        await evalJs(`[
        document.querySelector('#menu h2').textContent,
        document.querySelector('#video-settings-open').textContent,
        document.querySelector('#audio-settings-open').textContent,
        ...['controls','saves','recording'].map(name=>document.querySelector('#'+name+'-settings-open').textContent),
        document.querySelector('#recording-export').textContent,
      ]`),
        [
          'Optionen',
          'Grafik',
          'Audio',
          'Steuerung',
          'Spiel speichern/laden',
          'Aufzeichnung',
          'Aufzeichnung exportieren (.json)',
        ],
      );
      await click('#audio-settings-open');
      await click('#analog-audio');
      assert.equal(
        await evalJs("document.querySelector('#analog-audio').textContent"),
        'Analoger Audiofilter: aus',
      );
      await click('#audio-settings-close');
      assert.equal(
        await evalJs("document.querySelector('#bindings button').textContent"),
        'ändern',
      );
      assert.match(
        await evalJs("document.querySelector('#save-status').textContent"),
        /Noch kein Spielstand/,
      );
      await evalJs(`(async()=>{const {parseBindings}=await import('/src/browser/controls.mjs');
        const bindings=parseBindings(null);bindings.A=['key:k'];
        localStorage.setItem('shadowrun.bindings.4',JSON.stringify(bindings));})()`);
      await cdp.call('Page.reload');
      await evalJs(waitFor("()=>document.querySelector('#manual-open')?.textContent==='Handbuch'"));
      await click('#menu-toggle');
      await click('#manual-open');
      assert.equal(await evalJs("document.querySelector('#manual').lang"), 'de');
      assert.match(await evalJs("document.querySelector('#manual').innerText"), /Benötigte Stärke/);
      assert.doesNotMatch(
        await evalJs("document.querySelector('#manual').innerText"),
        /US-Handbuch|PDF-Seite|gedruckten Handbuch/,
      );
      await click('#manual-search');
      await cdp.call('Input.insertText', { text: 'Heilung 5' });
      assert.equal(
        await evalJs(activeChapter),
        'magic',
        'search highlights the visible result chapter',
      );
      assert.deepEqual(
        await evalJs("[...document.querySelectorAll('#manual article')].map(e=>e.dataset.entry)"),
        ['heal'],
      );
      await evalJs(
        "document.querySelector('#manual-search').value='Summon Spirit';document.querySelector('#manual-search').dispatchEvent(new Event('input'))",
      );
      assert.deepEqual(
        await evalJs("[...document.querySelectorAll('#manual article')].map(e=>e.dataset.entry)"),
        ['summon-spirit'],
      );
      await evalJs(
        "document.querySelector('#manual-search').value='Passwörter';document.querySelector('#manual-search').dispatchEvent(new Event('input'))",
      );
      const matrixResults = await evalJs(
        "[...document.querySelectorAll('#manual article')].map(e=>e.dataset.entry)",
      );
      assert.ok(
        matrixResults.includes('matrix-nodes') && matrixResults.includes('matrix-data-types'),
      );
      assert.equal(await evalJs(activeChapter), 'matrix');
      await evalJs(
        "document.querySelector('#manual-search').value='<img src=x onerror=alert(1)>';document.querySelector('#manual-search').dispatchEvent(new Event('input'))",
      );
      assert.equal(await evalJs("document.querySelectorAll('#manual img').length"), 0);
      assert.equal(
        await evalJs("document.querySelectorAll('#manual nav [aria-pressed=true]').length"),
        0,
        'empty search results have no active chapter',
      );
      assert.match(
        await evalJs("document.querySelector('.manual-empty').textContent"),
        /Keine Treffer/,
      );
      await click('#manual nav [data-chapter="controls"]');
      assert.match(
        await evalJs("document.querySelector('[data-entry=current-bindings]').innerText"),
        /Linke Maustaste/,
      );
      assert.match(
        await evalJs("document.querySelector('[data-entry=current-bindings]').innerText"),
        /Waffenfadenkreuz öffnen[\s\S]*?K/,
      );
      assert.match(
        await evalJs("document.querySelector('[data-entry=firing]').textContent"),
        /mit K das Fadenkreuz/,
      );
      assert.doesNotMatch(
        await evalJs("document.querySelector('#manual').textContent"),
        /SNES-Taste|\{\w+\}/,
      );
      await press('Tab', 'Tab');
      assert.equal(
        await evalJs("document.querySelector('#manual').contains(document.activeElement)"),
        true,
      );
      await close();

      // Rebind through the real settings, then reopen without a page reload.
      await click('#menu-toggle');
      await click('#controls-settings-open');
      assert.equal(
        await evalJs("document.querySelector('[data-control=A] strong').textContent"),
        'Zielen / Schießen',
      );
      assert.match(
        await evalJs("document.querySelector('[data-control=A] small').textContent"),
        /Matrix/,
      );
      await click('[data-control=A] button');
      assert.equal(
        await evalJs("document.querySelector('#controls-settings').open"),
        true,
        'choosing change must keep the settings open',
      );
      await press('KeyJ', 'j');
      assert.equal(
        await evalJs("document.querySelector('#controls-settings').open"),
        true,
        'assigning a key must keep the settings open',
      );
      assert.deepEqual(await evalJs("JSON.parse(localStorage.getItem('shadowrun.bindings.4')).A"), [
        'key:j',
      ]);
      await click('#controls-settings-close');
      await click('#menu-toggle');
      await click('#manual-open');
      assert.equal(
        await evalJs("document.querySelector('#manual').open"),
        true,
        'reopening after rebinding must open the dialog',
      );
      assert.match(
        await evalJs("document.querySelector('[data-entry=firing]').textContent"),
        /mit J das Fadenkreuz/,
      );
      await close();
      await click('#menu-toggle');
      await click('#controls-settings-open');
      await click('[data-control=X] button');
      await press('KeyJ', 'j');
      assert.equal(
        await evalJs("document.querySelector('[data-control=A] > span:nth-child(2)').textContent"),
        'Nicht belegt',
      );
      await click('#controls-settings-close');
      await click('#menu-toggle');
      await click('#manual-open');
      assert.match(
        await evalJs("document.querySelector('[data-entry=firing]').textContent"),
        /mit Nicht belegt das Fadenkreuz/,
      );
      assert.match(
        await evalJs("document.querySelector('[data-entry=learning-magic]').textContent"),
        /J öffnet die Zauberhand/,
      );
      await close();
      await click('#menu-toggle');
      await click('#controls-settings-open');
      await click('#reset-bindings');
      await click('#controls-settings-close');
      await click('#menu-toggle');
      await click('#manual-open');
      assert.match(
        await evalJs("document.querySelector('[data-entry=firing]').textContent"),
        /mit F das Fadenkreuz/,
      );
      await close();

      // A real click is required to enter fullscreen; then both panels must be hit-testable.
      await click('#menu-toggle');
      await click('#fullscreen');
      await evalJs(
        waitFor(
          "()=>document.fullscreenElement?.id==='frame'&&document.querySelector('#fullscreen').textContent==='Vollbild verlassen'&&document.querySelector('#frame').dataset.escape",
        ),
      );
      assert.equal(
        await evalJs("document.querySelector('#fullscreen').textContent"),
        'Vollbild verlassen',
      );
      assert.equal(
        await evalJs("getComputedStyle(document.querySelector('#menu-toggle')).display==='none'"),
        false,
      );
      await click('#menu-toggle');
      for (const narrow of [false, true]) {
        if (narrow)
          await cdp.call('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 660,
            deviceScaleFactor: 1,
            mobile: false,
          });
        const menuLayout = await evalJs(`(async()=>{
          const panel=document.querySelector('#menu'),toggle=document.querySelector('#menu-toggle');
          panel.scrollTop=0;
          await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
          const p=panel.getBoundingClientRect(),b=toggle.getBoundingClientRect();
          const reachable=element=>{const r=element.getBoundingClientRect();
            return element.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));};
          return {separate:p.top>=b.bottom,fits:p.left>=0&&p.right<=innerWidth&&p.bottom<=innerHeight,
            toggleReachable:reachable(toggle),closeReachable:reachable(document.querySelector('#menu-close')),
            firstOptionReachable:reachable(document.querySelector('#language'))};
        })()`);
        assert.deepEqual(
          menuLayout,
          {
            separate: true,
            fits: true,
            toggleReachable: true,
            closeReachable: true,
            firstOptionReachable: true,
          },
          `the fullscreen menu and its toggle remain separate at ${narrow ? 'narrow' : 'wide'} width`,
        );
        const menuShot = await cdp.call('Page.captureScreenshot', { format: 'png' });
        await writeFile(
          join(logDir, `options-fullscreen-${narrow ? 'narrow' : 'wide'}.png`),
          Buffer.from(menuShot.data, 'base64'),
        );
        await click('#menu-close');
        assert.equal(await evalJs("document.querySelector('#menu').hidden"), true);
        await click('#menu-toggle');
      }
      await cdp.call('Emulation.clearDeviceMetricsOverride');
      await click('#manual-open');
      assert.equal(
        await evalJs(
          "document.querySelector('#frame').contains(document.querySelector('#manual'))",
        ),
        true,
      );
      await press('Escape', 'Escape');
      await evalJs(waitFor("()=>!document.querySelector('#manual').open"));
      assert.equal(await evalJs('document.fullscreenElement?.id'), 'frame');
      await click('#menu-toggle');
      await click('#fullscreen');
      await evalJs(waitFor('()=>!document.fullscreenElement'));

      await cdp.call('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 660,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await click('#menu-toggle');
      await click('#controls-settings-open');
      assert.equal(
        await evalJs(
          "document.querySelector('#controls-settings').scrollWidth<=document.querySelector('#controls-settings').clientWidth",
        ),
        true,
        'function labels and descriptions fit the narrow settings panel',
      );
      await click('[data-control=A] button');
      await press('KeyF', 'f');
      const settingsShot = await cdp.call('Page.captureScreenshot', { format: 'png' });
      await writeFile(
        join(logDir, 'controls-mobile.png'),
        Buffer.from(settingsShot.data, 'base64'),
      );
      await click('#controls-settings-close');
      await click('#menu-toggle');
      await click('#manual-open');
      const layout =
        await evalJs(`(()=>{const d=document.querySelector('#manual'),b=d.getBoundingClientRect();
        return {fits:b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight,
          overflow:d.scrollWidth>d.clientWidth};})()`);
      assert.deepEqual(layout, { fits: true, overflow: false });
      const shot = await cdp.call('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(logDir, 'manual-mobile.png'), Buffer.from(shot.data, 'base64'));
      await close();
      await cdp.call('Emulation.clearDeviceMetricsOverride');

      await evalJs(waitFor("()=>!document.querySelector('#start').disabled"));
      await evalJs("document.querySelector('#start').click()");
      await evalJs(waitFor("()=>Number(document.querySelector('#screen').dataset.nmi)>2"));
      // Pause independently first; the guide must leave that pause intact.
      await press('KeyP', 'p');
      assert.equal(await evalJs("document.querySelector('#screen').dataset.paused"), 'true');
      await click('#menu-toggle');
      await click('#manual-open');
      await close();
      assert.equal(await evalJs("document.querySelector('#screen').dataset.paused"), 'true');
      await press('KeyP', 'p');
      assert.equal(await evalJs("document.querySelector('#screen').dataset.paused"), 'false');
      await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w' });
      assert.notEqual(await evalJs("Number(document.querySelector('#screen').dataset.pad)"), 0);
      await click('#menu-toggle');
      await click('#manual-open');
      assert.equal(await evalJs("Number(document.querySelector('#screen').dataset.pad)"), 0);
      const before = await evalJs("document.querySelector('#screen').dataset.nmi");
      await evalJs(`globalThis.originalGetGamepads=navigator.getGamepads;
        Object.defineProperty(navigator,'getGamepads',{configurable:true,writable:true,value:()=>[
          {connected:true,buttons:[{pressed:true,value:1}],axes:[0,0]}
        ]})`);
      await click('#manual-search');
      for (const [code, key] of [
        ['KeyW', 'w'],
        ['KeyP', 'p'],
        ['KeyF', 'f'],
      ])
        await press(code, key);
      await evalJs('new Promise(resolve=>setTimeout(resolve,200))');
      assert.equal(await evalJs("document.querySelector('#screen').dataset.nmi"), before);
      assert.equal(await evalJs("Number(document.querySelector('#screen').dataset.pad)"), 0);
      assert.equal(await evalJs("document.querySelector('#screen').dataset.paused"), 'true');
      await evalJs('navigator.getGamepads=globalThis.originalGetGamepads');
      await close();
      assert.equal(await evalJs("document.querySelector('#screen').dataset.paused"), 'false');
      await evalJs(
        waitFor(`()=>Number(document.querySelector('#screen').dataset.nmi)>${Number(before)}`),
      );
      console.log(JSON.stringify({ logDir }));
    });
  },
);
