import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findEdge, withStartPage } from './browser-frame.mjs';
import { AUDIO_PROFILES, DEFAULT_AUDIO_PROFILE } from '../src/browser/audio-profiles.mjs';

const edge = findEdge();
const SETTINGS = [
  'audio',
  'about',
  'video',
  'controls',
  'saves',
  'recording',
  'game',
  'cheats',
  'manual',
];
const dialogId = (name) => (['cheats', 'manual'].includes(name) ? name : `${name}-settings`);
const openerId = (name) =>
  ['cheats', 'manual'].includes(name) ? `${name}-open` : `${name}-settings-open`;
const waitFor = (condition) => `new Promise((resolve,reject)=>{
  const end=Date.now()+30000;const check=()=>{
    const data=document.querySelector('#screen')?.dataset;
    if(data?.error||data?.audioError)reject(Error(JSON.stringify({...data})));
    else if(${condition})resolve(true);
    else if(Date.now()>end)reject(Error('Condition timed out: '+JSON.stringify({...data})));
    else setTimeout(check,25);
  };check();})`;

test(
  'All overlays share their appearance, contain the controls, persist profiles and isolate input in fullscreen and narrow views',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 180000 },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 40000 }, async ({ cdp, evalJs, logDir }) => {
      assert.equal(await evalJs("document.querySelector('#credits') === null"), true);
      const click = (selector) => evalJs(`document.querySelector('${selector}').click()`);
      const press = async (code, key = code) => {
        await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', code, key });
        await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', code, key });
      };
      const open = async (name) => {
        await click('#menu-toggle');
        await click(`#${openerId(name)}`);
      };
      const checked = "document.querySelector('#audio-settings input:checked').value";
      const appearance = (name) =>
        evalJs(`(()=>{
        const d=document.querySelector('#${dialogId(name)}');
        const style=(node,keys)=>{const s=getComputedStyle(node);return Object.fromEntries(keys.map(k=>[k,s[k]]));};
        const type=['fontFamily','fontSize','fontWeight','lineHeight'];
        const card=d.querySelector('.overlay-card');
        return {
          frame:style(d,[...type,'width','maxHeight','border','borderRadius','backgroundColor','boxShadow']),
          header:style(d.querySelector('.overlay-header'),['padding','gap','borderBottom']),
          title:style(d.querySelector('.overlay-header h2'),[...type,'color']),
          close:style(d.querySelector('.overlay-header button'),[...type,'padding','border','color']),
          body:style(d.querySelector('.overlay-body'),[...type,'padding']),
          copy:style(d.querySelector('.overlay-card p,.overlay-body>p,.manual-welcome p'),[...type,'margin']),
          ...(card?{card:style(card,['padding','border','borderRadius','backgroundColor'])}:{})
        };
      })()`);
      const assertAppearance = (actual, expected, label) => {
        const { card, ...common } = actual;
        const { card: referenceCard, ...reference } = expected;
        assert.deepEqual(common, reference, label);
        if (card) assert.deepEqual(card, referenceCard, `${label} cards`);
      };
      let wideAppearance, narrowAppearance, fullscreenAppearance;
      await evalJs(waitFor("data?.stage==='data'"));
      assert.deepEqual(
        await evalJs(`[
        document.querySelector('#audio-settings-open').textContent,
        document.querySelector('#video-settings-open').textContent,
        document.querySelectorAll('#menu #analog-audio,#menu #soundtrack,#menu #tribute-volume,#menu #crt,#menu #bezel,#menu #window-zoom,#menu #crt-settings').length
      ]`),
        ['Audio', 'Graphics', 0],
      );
      await open('about');
      assert.deepEqual(
        await evalJs(`(()=>{const d=document.querySelector('#about-settings'),link=d.querySelector('a');return [
          document.querySelector('#about-settings-open').textContent,
          ...[...d.querySelectorAll('.about-content p')].slice(0,2).map(n=>n.textContent),
          link.href,link.target,link.rel,getComputedStyle(d.querySelector('.about-content')).textAlign
        ];})()`),
        [
          'About this project',
          'Tribute soundtrack arranged, performed and produced by Julian Daniels',
          'Original soundtrack by Marshall Parker',
          'https://www.juliandaniels.com/',
          '_blank',
          'noopener noreferrer',
          'center',
        ],
      );
      await click('#about-settings-close');
      assert.deepEqual(
        await evalJs(`(()=>{const d=document.querySelector('#about-settings');return [
          d.querySelector('[data-menu-text=projectGithub]').textContent,
          d.querySelector('hr')!==null,d.querySelectorAll('a')[1].href
        ];})()`),
        ['This project on GitHub:', true, 'https://github.com/StefanKubsch/SNES_Shadowrun'],
      );
      await open('audio');
      assert.deepEqual(
        await evalJs(`(()=>{const d=document.querySelector('#audio-settings');return {
        modal:d.matches(':modal'),parent:d.parentElement.id,lang:d.lang,
        focus:document.activeElement.id,menuHidden:document.querySelector('#menu').hidden,
        controls:['analog-audio','soundtrack','tribute-volume'].every(id=>d.contains(document.getElementById(id))),
        profiles:[...d.querySelectorAll('input[type=radio]')].map(r=>r.value),
        filter:document.querySelector('#analog-audio').getAttribute('aria-pressed')};})()`),
        {
          modal: true,
          parent: 'frame',
          lang: 'en',
          focus: 'audio-settings-close',
          menuHidden: true,
          controls: true,
          profiles: Object.keys(AUDIO_PROFILES),
          filter: 'true',
        },
      );
      assert.equal(await evalJs(checked), DEFAULT_AUDIO_PROFILE);
      assert.equal(await evalJs("document.querySelectorAll('#menu details').length"), 0);
      assert.deepEqual(
        await evalJs("[...document.querySelector('#menu-actions').children].map(n=>n.id)"),
        [
          'language',
          'about-settings-open',
          'manual-open',
          'video-settings-open',
          'audio-settings-open',
          'controls-settings-open',
          'game-settings-open',
          'cheats-open',
          'debug-room',
          'saves-settings-open',
          'recording-settings-open',
          'fullscreen',
        ],
      );
      assert.deepEqual(
        await evalJs(`[
        document.querySelector('#fullscreen').closest('#menu')?.id,
        document.querySelector('#four-save-slots').closest('dialog')?.id,
        ...['bugfixes','prevent-exploits','object-markers'].map(id=>document.getElementById(id).closest('dialog')?.id)
      ]`),
        ['menu', 'saves-settings', 'game-settings', 'game-settings', 'game-settings'],
      );
      await click('#analog-audio');
      await evalJs(`document.querySelector('input[name="audio-profile"]').focus()`);
      await press('ArrowDown');
      assert.equal(await evalJs(checked), 'pal_1chip_reference_150n_100k');
      const profile = 'pal_1chip_optional_lp12k';
      await click(`input[value="${profile}"]`);
      await click('#soundtrack');
      await evalJs(
        `(()=>{const slider=document.querySelector('#tribute-volume');slider.value=35;slider.dispatchEvent(new Event('input'));})()`,
      );
      assert.deepEqual(
        await evalJs(`[
        localStorage.getItem('shadowrun.audio.analog.1'),localStorage.getItem('shadowrun.audio.profile.1'),
        localStorage.getItem('shadowrun.soundtrack.1'),localStorage.getItem('shadowrun.soundtrack.volume.1')
      ]`),
        ['off', profile, 'original', '0.35'],
      );
      await press('Escape');
      await evalJs(
        waitFor(
          "!document.querySelector('#audio-settings').open&&document.activeElement.id==='menu-toggle'",
        ),
      );
      await click('#menu-toggle');
      await click('#language');
      await evalJs(
        waitFor("document.querySelector('#video-settings-open').textContent==='Grafik'"),
      );
      await click('#audio-settings-open');
      assert.equal(await evalJs("document.querySelector('#audio-settings').lang"), 'de');
      assert.equal(
        await evalJs("document.querySelector('#soundtrack').textContent"),
        'Musik: Original',
      );
      assert.match(
        await evalJs("document.querySelector('#audio-settings').innerText"),
        /keine Messungen|keine Messungen an Originalkonsolen/,
      );
      for (const name of SETTINGS) {
        if (name === 'game')
          assert.equal(
            await evalJs(`['bugfixes','prevent-exploits','object-markers'].every(id=>{
          const button=document.getElementById(id),help=document.getElementById(button.getAttribute('aria-describedby'));
          return help?.textContent.length>0&&document.querySelector('#game-settings').contains(help);
        })`),
            true,
          );
        if (name !== 'audio') {
          const previous = SETTINGS[SETTINGS.indexOf(name) - 1];
          await click(`#${dialogId(previous)}-close`);
          await open(name);
        }
        if (name === 'about')
          assert.deepEqual(
            await evalJs(`[
              document.querySelector('#about-settings-open').textContent,
              ...[...document.querySelectorAll('#about-settings .about-content p')].slice(0,2).map(n=>n.textContent)
            ]`),
            [
              'Über dieses Projekt',
              'Tribute Soundtrack arrangiert, eingespielt und produziert von Julian Daniels',
              'Originaler Soundtrack von Marshall Parker',
            ],
          );
        if (name === 'about')
          assert.equal(
            await evalJs(
              "document.querySelector('#about-settings [data-menu-text=projectGithub]').textContent",
            ),
            'Dieses Projekt auf GitHub:',
          );
        const geometry =
          await evalJs(`(()=>{const d=document.querySelector('#${dialogId(name)}'),c=d.querySelector('.overlay-body');
          return {gap:d.getBoundingClientRect().bottom-c.getBoundingClientRect().bottom,
          height:d.getBoundingClientRect().height,scroll:c.scrollHeight>c.clientHeight+1};})()`);
        assert.ok(geometry.gap <= 2, `${name} frame fits its content: ${JSON.stringify(geometry)}`);
        const wide = await appearance(name);
        wideAppearance ??= wide;
        assertAppearance(wide, wideAppearance, `${name} wide appearance`);
        const wideShot = await cdp.call('Page.captureScreenshot', { format: 'png' });
        await writeFile(
          join(logDir, `${name}-settings-wide.png`),
          Buffer.from(wideShot.data, 'base64'),
        );
        await cdp.call('Emulation.setDeviceMetricsOverride', {
          width: 390,
          height: 720,
          deviceScaleFactor: 1,
          mobile: false,
        });
        assert.equal(
          await evalJs(`(()=>{const d=document.querySelector('#${dialogId(name)}'),b=d.getBoundingClientRect();
          return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth;})()`),
          true,
        );
        const narrow = await appearance(name);
        narrowAppearance ??= narrow;
        assertAppearance(narrow, narrowAppearance, `${name} narrow appearance`);
        if (name === 'video')
          assert.equal(
            await evalJs(
              `['crt','bezel','window-zoom','crt-brightness','crt-contrast'].every(id=>document.querySelector('#video-settings').contains(document.getElementById(id)))`,
            ),
            true,
          );
        const shot = await cdp.call('Page.captureScreenshot', { format: 'png' });
        await writeFile(
          join(logDir, `${name}-settings-narrow.png`),
          Buffer.from(shot.data, 'base64'),
        );
        await cdp.call('Emulation.clearDeviceMetricsOverride');
      }
      await click('#manual-close');
      await click('#menu-toggle');
      await click('#fullscreen');
      await evalJs(
        waitFor("!!document.fullscreenElement&&!!document.querySelector('#frame').dataset.escape"),
      );
      for (const name of SETTINGS) {
        await open(name);
        const full = await appearance(name);
        fullscreenAppearance ??= full;
        assertAppearance(full, fullscreenAppearance, `${name} fullscreen appearance`);
        assert.equal(
          await evalJs(
            `document.fullscreenElement.contains(document.querySelector('#${dialogId(name)}'))&&document.querySelector('#${dialogId(name)}').matches(':modal')`,
          ),
          true,
        );
        await press('Escape');
        await evalJs(waitFor(`!document.querySelector('#${dialogId(name)}').open`));
        assert.equal(await evalJs('!!document.fullscreenElement'), true);
      }
      await evalJs('document.exitFullscreen()');
      await cdp.call('Page.reload');
      await new Promise((resolve) => setTimeout(resolve, 250));
      await evalJs(waitFor("data?.stage==='data'"));
      assert.equal(await evalJs(checked), profile);
      assert.equal(
        await evalJs("document.querySelector('#analog-audio').getAttribute('aria-pressed')"),
        'false',
      );
      assert.equal(await evalJs("document.querySelector('#tribute-volume').value"), '35');
      await click('#start');
      await evalJs(
        waitFor(
          `data?.ready==='true'&&data.audioProfile==='${profile}'&&data.audioAnalog==='false'`,
        ),
      );
      for (const name of SETTINGS) {
        await open(name);
        const before = await evalJs("document.querySelector('#screen').dataset.nmi");
        await press('KeyW', 'w');
        await press('KeyP', 'p');
        await new Promise((resolve) => setTimeout(resolve, 160));
        assert.deepEqual(
          await evalJs(
            `(()=>{const d=document.querySelector('#screen').dataset;return [d.nmi,d.pad,d.paused];})()`,
          ),
          [before, '0', 'true'],
        );
        if (name === 'controls') {
          assert.equal(
            await evalJs("getComputedStyle(document.querySelector('#bindings small')).display"),
            'none',
          );
          await click('#control-explanations');
          assert.notEqual(
            await evalJs("getComputedStyle(document.querySelector('#bindings small')).display"),
            'none',
          );
          await click('#control-explanations');
          await click('[data-control=A] button');
          await press('KeyK', 'k');
          assert.deepEqual(
            await evalJs("JSON.parse(localStorage.getItem('shadowrun.bindings.4')).A"),
            ['key:k'],
          );
          await click('#reset-bindings');
        }
        if (name === 'audio') {
          await click(`input[value="${DEFAULT_AUDIO_PROFILE}"]`);
          await click('#analog-audio');
        }
        await click(`#${dialogId(name)}-close`);
        await evalJs(waitFor(`data.nmi!==${JSON.stringify(before)}&&data.paused==='false'`));
        await evalJs(
          waitFor(`data.audioProfile==='${DEFAULT_AUDIO_PROFILE}'&&data.audioAnalog==='true'`),
        );
        await press('KeyP', 'p');
        await open(name);
        await click(`#${dialogId(name)}-close`);
        assert.equal(
          await evalJs("document.querySelector('#screen').dataset.paused"),
          'true',
          'P pause survives closing',
        );
        await press('KeyP', 'p');
      }
      await evalJs("localStorage.setItem('shadowrun.audio.profile.1','__proto__')");
      await cdp.call('Page.reload');
      await new Promise((resolve) => setTimeout(resolve, 250));
      await evalJs(waitFor("data?.stage==='data'"));
      assert.equal(
        await evalJs(checked),
        DEFAULT_AUDIO_PROFILE,
        'invalid stored profile falls back safely',
      );
      console.log(JSON.stringify({ logDir }));
    });
  },
);
