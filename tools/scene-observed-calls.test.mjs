import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sceneFrameCallSequence,
  sceneInputCallSequence,
} from '../src/system/scene-observed-calls.mjs';
import {
  NativeCallContinuation,
  nativeCallSequence,
} from '../src/system/native-call-continuation.mjs';
import { NativeWaitContinuation, WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import { MAIN_SCENE_ROUTINES } from '../proof/replay/main-scene.mjs';
import { NATIVE_CALL_CONTINUATIONS } from '../proof/replay/continuations.mjs';
import { createSide } from './lift-function-harness.mjs';
import * as W from '../src/data/wram.mjs';

function side(input, irq, root) {
  const state = createSide({ seed: 17, wram: new Uint8Array(0x20000) }, new Map()),
    { h, mem } = state;
  Object.assign(h.ctx, {
    a: 0xabcd,
    x: 0x1234,
    y: 0x5678,
    programBank: 0x81,
    bank: 0x80,
    pc: 0xcdf8,
  });
  mem.write16(W.PAD_HELD, input);
  mem.write16(W.PAD_PREVIOUS, 0x80);
  mem.wram[W.NMITIMEN_SHADOW] = irq ? 0 : 0x80;
  const events = {
    mode: 'record-observations',
    waitIndex: 0,
    waitEvents: [],
    inputIndex: 0,
    inputs: Object.freeze([
      Object.freeze({ pc: 0x809e1a, address: 0x800000 | W.PAD_HELD, width: 2, value: input }),
    ]),
    values: Object.freeze([
      Object.freeze({ pc: 0x81eecd, address: 0x7e0000 | W.RANDOM_STATE, width: 1, value: 1 }),
    ]),
  };
  if (irq) {
    const probe = side(input, false, root),
      { h: ph } = probe;
    ph.a.mem.wram[W.NMITIMEN_SHADOW] = 0;
    Object.assign(ph.ctx, { programBank: root >>> 16, pc: root & 0xffff });
    ph.pushByte(0x81);
    ph.a.pushWord(0x1234);
    const records = [],
      wait = new NativeWaitContinuation(ph.a, root);
    wait.run(Infinity, {
      beforeInstruction: (pc) => records.push(Object.freeze({ pc, nmi: false })),
    });
    events.interrupts = Object.freeze(records);
    events.interruptIndex = 0;
  }
  return { ...state, events };
}

function run(direct, target, input, irq, budget, missing = false, site = 0x81cdf8) {
  const root = target === 0x80f298 ? 0x809e1a : target,
    state = side(input, irq, root),
    { h, mem, events } = state;
  if (missing) {
    events.inputs = Object.freeze([]);
    events.values = Object.freeze([]);
    if (irq) events.interrupts = Object.freeze([]);
  }
  const sequence = direct
    ? (target === 0x80f298 ? sceneInputCallSequence : sceneFrameCallSequence)(h, events, site)
    : nativeCallSequence(h, events, MAIN_SCENE_ROUTINES, site, target, true);
  const continuation = new NativeCallContinuation(h.a, sequence, NATIVE_CALL_CONTINUATIONS),
    before = mem.wram.slice();
  assert.equal(continuation.run(0), WAIT_PAUSED);
  assert.deepEqual(mem.wram, before);
  let stop;
  try {
    let steps = 0;
    while (continuation.run(budget) === WAIT_PAUSED) assert.ok(++steps < 1000);
  } catch (error) {
    if (!error.taskBoundary) throw error;
    stop = {
      reason: error.reason,
      pc: error.pc,
      target: error.target,
      observationIndex: error.observationIndex,
    };
  }
  return {
    wram: mem.wram,
    ctx: { ...h.ctx },
    writes: state.writes,
    waitIndex: events.waitIndex,
    inputIndex: events.inputIndex,
    interruptIndex: events.interruptIndex,
    stop,
  };
}

for (const budget of [1, 7])
  for (const irq of [false, true])
    for (const target of [0x81eebb, 0x80f298])
      for (const input of [0, 0x80, 0x1000, 0x1001])
        test(`fixed scene call ${target.toString(16)}, input ${input}, interrupts ${irq}, budget ${budget}`, () => {
          assert.deepEqual(
            run(true, target, input, irq, budget),
            run(false, target, input, irq, budget),
          );
        });

for (const budget of [1, 7])
  for (const target of [0x81eebb, 0x80f298])
    for (const irq of [false, true])
      test(`missing scene observation ${target.toString(16)}, interrupts ${irq}, budget ${budget}`, () => {
        const actual = run(true, target, 0, irq, budget, true);
        assert.deepEqual(actual, run(false, target, 0, irq, budget, true));
        assert.ok(actual.stop);
      });

for (const budget of [1, 7])
  test(`fixed scene input retains the soft-reset frontier, budget ${budget}`, () => {
    const actual = run(true, 0x80f298, 0x3030, false, budget);
    assert.deepEqual(actual, run(false, 0x80f298, 0x3030, false, budget));
    assert.equal(actual.stop.reason, 'task_reset_source_required');
  });

for (const budget of [1, 7])
  for (const irq of [false, true])
    for (const [target, site] of [
      [0x81eebb, 0x81e07e],
      [0x80f298, 0x81e082],
    ])
      test(`intro fixed call preserves its original frame ${site.toString(16)}, interrupts ${irq}, budget ${budget}`, () => {
        assert.deepEqual(
          run(true, target, 0x1000, irq, budget, false, site),
          run(false, target, 0x1000, irq, budget, false, site),
        );
      });
