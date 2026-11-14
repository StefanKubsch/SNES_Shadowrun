import test from 'node:test';
import assert from 'node:assert/strict';
import { withStartPage, findEdge } from './browser-frame.mjs';
import {
  AUDIO_HEADROOM,
  AudioPlaybackOutput,
  DSP_SAMPLE_RATE,
  PalAudioOutput,
} from '../src/browser/audio-output.mjs';

const edge = findEdge();
test(
  'the real AudioWorklet applies the output circuit and keeps its underflow tail',
  {
    skip: edge ? false : 'Microsoft Edge not found',
    timeout: 120000,
  },
  async () => {
    const result = await withStartPage(
      { exe: edge, commandTimeout: 30000 },
      async ({ evalJs, logDir }) => ({
        ...(await evalJs(`(async () => {
      const length = 4096, pairs = 2048;
      const paths=[];
      for (const {enabled,audioProfile,changeProfile} of [
        {enabled:true}, {enabled:false},
        {enabled:true,audioProfile:'pal_1chip_optional_lp12k'},
        {enabled:false,audioProfile:'pal_1chip_optional_lp12k'},
        {enabled:true,audioProfile:'pal_1chip_optional_lp12k',changeProfile:true},
        {enabled:false,audioProfile:'pal_1chip_optional_lp12k',changeProfile:true}
      ]) {
        const context = new OfflineAudioContext(2, length, 32000);
        const samples = new Int16Array(2 * pairs);
        samples[64 * 2] = 16000;
        samples[128 * 2 + 1] = -8000;
        // Actual game startup includes valid frames without any DSP output.
        // Seed the fixture synchronously through the actual message handler in
        // a test-only subclass. MessagePort delivery plus a fixed 20 ms wait
        // does not guarantee the queue is populated before offline rendering.
        // The production module and inherited process() remain unchanged.
        const prelude = URL.createObjectURL(new Blob([
          "const original = globalThis.registerProcessor;" +
          "globalThis.registerProcessor = (name, Processor) => {" +
          "  class FixtureProcessor extends Processor {" +
          "    constructor(options) { super(options);" +
          "      for (const data of options.processorOptions.fixtureChunks)" +
          "        this.port.onmessage({data});" +
          "    }" +
          "  }" +
          "  original(name, FixtureProcessor);" +
          "  globalThis.registerProcessor = original;" +
          "};"
        ], {type:'text/javascript'}));
        try { await context.audioWorklet.addModule(prelude); }
        finally { URL.revokeObjectURL(prelude); }
        await context.audioWorklet.addModule('/src/browser/audio-worklet.mjs');
        const node = new AudioWorkletNode(context, 'snes-audio', {
          numberOfInputs: 0, outputChannelCount: [2],
          processorOptions:{
            ...(!enabled ? {analogEnabled:false} : {}),
            ...(audioProfile && !changeProfile ? {audioProfile} : {}),
            fixtureChunks:[
              ...(changeProfile ? [{command:'audio-profile',profile:audioProfile},{command:'audio-profile',profile:'__proto__'}] : []),
              new Int16Array(0), samples, new Int16Array(0)]
          }
        });
        node.connect(context.destination);
        const rendered = await context.startRendering();
        paths.push({ enabled, audioProfile, rate: rendered.sampleRate,
          left: Array.from(rendered.getChannelData(0)),
          right: Array.from(rendered.getChannelData(1)) });
      }
      return {paths};
    })()`)),
        logDir,
      }),
    );
    assert.ok(result.paths.every((path) => path.rate === DSP_SAMPLE_RATE));
    const left = new Float32Array(4096),
      right = new Float32Array(4096);
    left[64] = 16000 / 32768;
    right[128] = -8000 / 32768;
    new PalAudioOutput().process(left, right);
    for (const [expected, actual] of [
      [left, result.paths[0].left],
      [right, result.paths[0].right],
    ])
      for (let i = 0; i < expected.length; i++)
        assert.ok(
          Math.abs(expected[i] * AUDIO_HEADROOM - actual[i]) < 2e-7,
          `sample ${i}, ${result.logDir}`,
        );
    assert.ok(
      result.paths[0].left.slice(2048).some((value) => Math.abs(value) > 1e-8),
      'underflow tail is audible-path state',
    );
    assert.equal(result.paths[1].left[64 + 32], (16000 / 32768) * AUDIO_HEADROOM);
    assert.equal(result.paths[1].right[128 + 32], (-8000 / 32768) * AUDIO_HEADROOM);
    assert.ok(result.paths[1].left.every((value, i) => i === 96 || value === 0));
    for (const path of result.paths.slice(2)) {
      const expectedLeft = new Float32Array(4096),
        expectedRight = new Float32Array(4096),
        playback = new AudioPlaybackOutput({ profile: path.audioProfile, enabled: path.enabled });
      expectedLeft[64] = 16000 / 32768;
      expectedRight[128] = -8000 / 32768;
      playback.process(expectedLeft, expectedRight);
      assert.ok(
        playback.presentationGain < AUDIO_HEADROOM,
        'experimental profile needs its own gain',
      );
      for (let i = 0; i < expectedLeft.length; i++) {
        assert.ok(Math.abs(path.left[i] - expectedLeft[i]) < 2e-7);
        assert.ok(Math.abs(path.right[i] - expectedRight[i]) < 2e-7);
      }
    }
    console.log(JSON.stringify({ samples: left.length, logDir: result.logDir }));
  },
);

test(
  'Options keeps the default-on audio filter choice across reload and sends live changes to the worklet',
  {
    skip: edge ? false : 'Microsoft Edge not found',
    timeout: 120000,
  },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs, logDir }) => {
      const initial = await evalJs(`(()=>{
      document.querySelector('#menu-toggle').click();
      document.querySelector('#audio-settings-open').click();
      const button=document.querySelector('#analog-audio');
      return {title:document.querySelector('#menu h2').textContent,
        nav:document.querySelector('#menu').getAttribute('aria-label'),
        burger:document.querySelector('#menu-toggle').getAttribute('aria-label'),
        enabled:button.getAttribute('aria-pressed'),text:button.textContent,
        visible:button.getBoundingClientRect().width>0};
    })()`);
      assert.deepEqual(initial, {
        title: 'Options',
        nav: 'Options',
        burger: 'Options',
        enabled: 'true',
        text: 'Analog audio filter: on',
        visible: true,
      });
      await evalJs("document.querySelector('#analog-audio').click()");
      await evalJs("document.querySelector('#audio-settings-close').click()");
      assert.equal(await evalJs("localStorage.getItem('shadowrun.audio.analog.1')"), 'off');
      await cdp.call('Page.reload');
      await new Promise((resolve) => setTimeout(resolve, 250));
      await evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{
      const screen=document.querySelector('#screen');
      if(screen?.dataset.stage==='data')resolve(true);
      else if(Date.now()>end)reject(Error('Reloaded page did not become ready'));else setTimeout(check,25);
    };check();})`);
      assert.equal(
        await evalJs("document.querySelector('#analog-audio').getAttribute('aria-pressed')"),
        'false',
      );
      await evalJs("document.querySelector('#start').click()");
      const waitForAudio = (enabled) =>
        evalJs(`new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{
      const data=document.querySelector('#screen').dataset;
      if(data.audioError)reject(Error(data.audioError));
      else if(data.audioAnalog==='${enabled}')resolve(true);
      else if(Date.now()>end)reject(Error('Worklet did not report filter state: '+JSON.stringify({...data})));
      else setTimeout(check,25);
    };check();})`);
      await waitForAudio(false);
      await evalJs(
        "document.querySelector('#menu-toggle').click(); document.querySelector('#audio-settings-open').click(); document.querySelector('#analog-audio').click(); document.querySelector('#audio-settings-close').click()",
      );
      await waitForAudio(true);
      assert.equal(await evalJs("localStorage.getItem('shadowrun.audio.analog.1')"), 'on');
      assert.equal(
        await evalJs("document.querySelector('#analog-audio').textContent"),
        'Analog audio filter: on',
      );
      console.log(JSON.stringify({ liveToggle: true, logDir }));
    });
  },
);
