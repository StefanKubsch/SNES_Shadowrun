import test from 'node:test';
import assert from 'node:assert/strict';
import { hitObject } from '../src/game/object-hit.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { textWindowSide } from './text-window-caller-harness.mjs';
import * as W from '../src/data/wram.mjs';

for (const hits of [3, 7])
  for (const counter of [0, 0xffff])
    test(`hit notice composes thirty waits without CPU frames: hits ${hits}, counter ${counter}`, () => {
      const side = textWindowSide(),
        { h, a, mem, put, events } = side;
      put(W.OBJECT_FLAGS + 2, 0x8000);
      put(W.HARMLESS_HITS, hits);
      put(W.KARMA, 9);
      put(W.RANDOM_STATE, counter);
      Object.assign(h.ctx, { s: 0x1eef, pc: 0x5678, programBank: 0x84 });
      const context = { ...h.ctx },
        stack = mem.wram.slice(0x1e80, 0x1ef0);
      const unchanged = () => {
        assert.deepEqual(h.ctx, context);
        assert.deepEqual(mem.wram.slice(0x1e80, 0x1ef0), stack);
      };
      const forbidden = () => assert.fail('notice used a CPU call or return helper');
      h.push = h.pushByte = h.rts = h.rtl = a.pushWord = a.pullWord = forbidden;
      events.frameJobs = () => assert.fail('fixture services every wait');
      const upload = events.interrupts.textWait;
      let waits = 0;
      events.interrupts.textWait = (...args) => {
        unchanged();
        if (args[3] !== 0x81b0a9) return upload(...args);
        waits++;
        put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
        if (waits > 30) put(W.PAD_HELD, W.PAD_A);
        return true;
      };
      const runner = new SequenceRunner(hitObject(h, events, undefined, 5, 2, 0xffff));
      const before = mem.wram.slice();
      assert.equal(runner.run(0), WAIT_PAUSED);
      assert.deepEqual(mem.wram, before);
      let steps = 0;
      while (!runner.done) {
        runner.run(1);
        unchanged();
        assert.ok(++steps < 20000);
      }
      assert.equal(waits, 31);
      assert.equal(mem.read16(W.WRAM + W.KARMA), hits === 7 ? 1 : 9);
      assert.equal(mem.read16(W.WRAM + W.HARMLESS_HITS), hits === 7 ? 0 : 4);
      const completed = mem.wram.slice();
      runner.run(7);
      assert.deepEqual(mem.wram, completed);
      assert.equal(waits, 31);
    });
