import test from 'node:test';
import assert from 'node:assert/strict';
import { cutsceneSequence as direct } from '../src/cutscene/cutscene-scene.mjs';
import { cutsceneSequence as former } from '../proof/caller/cutscene-scene.mjs';
import { introSequence } from '../src/intro/intro-scene.mjs';
import { introSequence as formerIntro } from '../proof/caller/intro-scene.mjs';
import { createSide } from './lift-function-harness.mjs';
import { LagFreeFrames } from '../src/vm/frame-events.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from '../src/system/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import * as W from '../src/data/wram.mjs';

function run(sequence, scene, budget, status = 0) {
  const side = createSide({ seed: 17, wram: new Uint8Array(0x20000) }, new Map()),
    { h, a, mem } = side;
  a.vm.menuCredits = true;
  for (let n = 0; n < 3; n++) mem.wram[0x8c + n] = mem.read8(0x98fffa + n);
  const frames = new LagFreeFrames({ nmitimen: 0x80 }),
    events = { interrupts: frames },
    waits = [];
  frames.textWait = (_h, _events, _status, pc) => {
    waits.push(pc);
    mem.wram[W.RANDOM_STATE]++;
    mem.wram[W.SCENE_BRIGHTNESS] = mem.wram[W.SCENE_BRIGHTNESS_TARGET];
    mem.write16(W.PAD_HELD, W.PAD_START);
    return true;
  };
  Object.assign(a.ctx, { a: scene, x: 0, status, programBank: 0x81, bank: 0x80, pc: 0xcdf8 });
  h.pushByte(0x80);
  h.a.pushWord(0x1234);
  const routines = new Map();
  const runIntro = (callee, e, r) => drainNativeSequence(formerIntro(callee, e, r)),
    runCutscene = (callee, e, r) => drainNativeSequence(former(callee, e, r));
  routines.set(0x81dfe7, runIntro);
  routines.set(0x81cdf8, runCutscene);
  NATIVE_CALL_CONTINUATIONS.set(runIntro, {
    run: runIntro,
    create: () => new NativeCallContinuation(a, formerIntro(h, events, routines)),
  });
  NATIVE_CALL_CONTINUATIONS.set(runCutscene, {
    run: runCutscene,
    create: () => new NativeCallContinuation(a, former(h, events, routines)),
  });
  const continuation = new NativeCallContinuation(a, sequence(h, events, routines));
  try {
    const before = mem.wram.slice();
    assert.equal(continuation.run(0), WAIT_PAUSED);
    assert.deepEqual(mem.wram, before);
    let calls = 0;
    while (continuation.run(budget) === WAIT_PAUSED) assert.ok(++calls < 100000);
    return {
      wram: mem.wram,
      writes: side.writes,
      waits,
      result: continuation.result,
      ctx: { ...a.ctx },
    };
  } finally {
    NATIVE_CALL_CONTINUATIONS.delete(runIntro);
    NATIVE_CALL_CONTINUATIONS.delete(runCutscene);
  }
}

for (const budget of [1, 7])
  for (const status of [0, 0x30])
    test(`cutscene intro tail owns the existing frame, budget ${budget}, status ${status}`, () => {
      const actual = run(direct, 0x14, budget, status);
      assert.deepEqual(actual, run(former, 0x14, budget, status));
      assert.equal(actual.ctx.s, 0x1c9);
      assert.equal(actual.ctx.programBank, 0x80);
      assert.equal(actual.ctx.pc, 0x1235);
    });

for (const budget of [1, 7])
  for (const status of [0, 0x30])
    test(`intro owns the nested mirrored credits call, budget ${budget}, status ${status}`, () => {
      const actual = run(introSequence, 0x14, budget, status);
      assert.deepEqual(actual, run(formerIntro, 0x14, budget, status));
      assert.ok(actual.waits.length > 16);
      assert.equal(actual.ctx.bank, 0x80);
      assert.equal(actual.ctx.pc, 0x1235);
    });
