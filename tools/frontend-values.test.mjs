import test from 'node:test';
import assert from 'node:assert/strict';
import { createSide } from './lift-function-harness.mjs';
import { playTitle } from '../src/frontend/title.mjs';
import { chooseStartGame } from '../src/frontend/start-menu.mjs';
import { playCutscene } from '../src/cutscene/cutscene-scene.mjs';
import { playIntro } from '../src/intro/intro-scene.mjs';
import { titleCycle } from '../src/frontend/title-cycle.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { LagFreeFrames } from '../src/vm/frame-events.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import * as W from '../src/data/wram.mjs';

// These scenes must finish with game services only: no CPU context, return frame
// or register (docs/FRONTEND-SERVICE-COMPOSITION.md). Existing differential tests
// keep checking their compatibility entries; goldens check actual frame jobs and
// the complete ordinary frontend/attract chain.
for (const budget of [1, 7])
  for (const [name, sequence, expected, button] of [
    ['title skip', (h, e) => playTitle(h, e), true, W.PAD_START],
    ['new game', (h, e) => chooseStartGame(h, e, false), 0xffff, W.PAD_START],
    ['title cycle', (h, e) => titleCycle(h, e, true), 0xffff, W.PAD_START],
    ['menu timeout', (h, e) => chooseStartGame(h, e, true), 0xfffe, 0],
    ['cutscene', (h, e) => playCutscene(h, e, 0, 0), undefined, W.PAD_START],
    ['intro', (h, e) => playIntro(h, e), undefined, W.PAD_START],
    ['intro scene', (h, e) => playCutscene(h, e, 0x14, 0), undefined, W.PAD_START],
  ])
    test(`ordinary ${name} takes game services only, budget ${budget}`, () => {
      const { h, a, mem } = createSide(
        { seed: 17, wram: new Uint8Array(0x20000), sram: new Uint8Array(0x2000) },
        new Map(),
      );
      a.vm.menuCredits = true;
      for (let n = 0; n < 3; n++) mem.wram[0x8c + n] = mem.read8(0x98fffa + n);
      const deviceRead = a.devices.read;
      a.devices.read = (address, width, site) =>
        address === 0x2142 ? (site === 0x81e510 ? 3 : 2) : deviceRead(address, width, site);
      const frames = new LagFreeFrames({ nmitimen: 0x80 });
      frames.textWait = () => {
        mem.write16(W.RANDOM_STATE, (mem.read16(W.RANDOM_STATE) + 1) & 0xffff);
        mem.wram[W.SCENE_BRIGHTNESS] = mem.wram[W.SCENE_BRIGHTNESS_TARGET];
        mem.write16(W.PAD_HELD, button);
        // The test controls presses independently of the scene's previous pad.
        mem.write16(W.PAD_PREVIOUS, 0);
        return true;
      };
      const noFrame = () => assert.fail('ordinary playback used a CPU frame');
      a.pushWord = a.pullWord = h.pushByte = h.pullByte = h.rts = h.rtl = noFrame;
      // Only the game services h.a are reachable; the CPU context is frozen.
      const services = new Proxy(
        { a },
        { get: (target, key) => (key === 'a' ? a : assert.fail(`scene read h.${String(key)}`)) },
      );
      const context = { ...a.ctx };
      Object.freeze(a.ctx);
      const runner = new SequenceRunner(
        sequence(services, { interrupts: frames, frameJobs: noFrame }, { get: noFrame }),
      );
      assert.equal(runner.run(0), WAIT_PAUSED);
      let steps = 0;
      for (;;) {
        const status = runner.run(budget);
        assert.ok(++steps < 100000, 'scene must finish');
        if (status !== WAIT_PAUSED) break;
      }
      assert.equal(runner.result, expected);
      assert.deepEqual({ ...a.ctx }, context, 'scene leaves the CPU context alone');
    });
