import test from 'node:test';
import assert from 'node:assert/strict';
import { playCutscene } from '../src/cutscene/cutscene-scene.mjs';
import { playIntro } from '../src/intro/intro-scene.mjs';
import { playMatrix } from '../src/matrix/matrix-scene.mjs';
import { createSide, assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { LagFreeFrames } from '../src/vm/frame-events.mjs';
import { NativeCallContinuation } from './register-forms/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import * as W from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

// The scenes 81:C3CA (matrix), 81:CDF8 (cutscene, with the intro 81:DFE7 as scene 14)
// play from game services without CPU frames. Game state only (user decision
// 2026-11-17): the outcome holds WRAM without the CPU stack and the interrupted A and S
// the NMI saves, the device writes and the serviced waits.
//
// Re-keyed on 2026-11-27, when the register-level scene entries (with their JSL return
// frame and the intro's nested cutscene frame) went: until then a test compared each
// scene body with its entry and found the same WRAM outside the CPU stack, the same
// device writes, waits and data bank.
const CPU_STACK_START = 0x100,
  CPU_STACK_END = 0x1ca;

function run(sequence, budget, status = 0) {
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
  Object.assign(a.ctx, { status, programBank: 0x81, bank: 0x80, pc: 0xcdf8 });
  const stack = h.ctx.s;
  h.pushByte =
    h.a.pushWord =
    h.rts =
    h.rtl =
      () => assert.fail('scene body must not use CPU frames');
  const continuation = new NativeCallContinuation(a, sequence(h, events));
  const before = mem.wram.slice();
  assert.equal(continuation.run(0), WAIT_PAUSED);
  assert.deepEqual(mem.wram, before);
  let calls = 0;
  while (continuation.run(budget) === WAIT_PAUSED) assert.ok(++calls < 100000);
  assert.equal(h.ctx.s, stack, 'scene preserves the caller stack');
  const wram = mem.wram.slice();
  wram.fill(0, CPU_STACK_START, CPU_STACK_END);
  wram.fill(0, W.NMI_SAVED_A, W.NMI_SAVED_STACK + 2);
  return { wram, writes: side.writes, waits, result: continuation.result };
}

const cutscene = (scene) => (h, events) => playCutscene(h, events, scene, 0);

for (const budget of [1, 7])
  test(`matrix setup, login and return own their waits, budget ${budget}`, () => {
    const actual = run(playMatrix, budget);
    assertFrozenRun(actual);
    assert.ok(actual.waits.length > 16);
  });

for (const budget of [1, 7])
  for (const status of [0, 0x30])
    test(`cutscene intro tail owns the existing frame, budget ${budget}, status ${status}`, () => {
      assertFrozenRun(run(cutscene(0x14), budget, status));
    });

for (const budget of [1, 7])
  for (const scene of [0, 1, 2, 3, 4, 0x8000, 0x8001, 0x8002, 0x8003, 0x8004])
    test(`actual cutscene body and mirror ${scene}, budget ${budget}`, () => {
      assertFrozenRun(run(cutscene(scene), budget));
    });

for (const budget of [1, 7])
  for (const status of [0, 0x30])
    test(`intro owns the nested mirrored credits call, budget ${budget}, status ${status}`, () => {
      const actual = run(playIntro, budget, status);
      assertFrozenRun(actual);
      assert.ok(actual.waits.length > 16);
    });
