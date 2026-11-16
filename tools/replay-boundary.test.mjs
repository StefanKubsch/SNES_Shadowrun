import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { SPECIAL_NATIVES, SPECIAL_NATIVE_CONTINUATIONS } from '../src/vm/special-natives.mjs';
import {
  SPECIAL_NATIVES as replayNatives,
  SPECIAL_NATIVE_CONTINUATIONS as replayContinuations,
} from '../proof/vm/special-natives.mjs';
import { NATIVE_CALL_CONTINUATIONS } from '../proof/replay/continuations.mjs';
import {
  NATIVE_CALL_CONTINUATIONS as shared,
  NativeCallContinuation,
} from '../src/system/native-call-continuation.mjs';
import { WAIT_PAUSED } from '../src/system/native-wait-continuation.mjs';
import {
  raiseStateCountSequence,
  restoreRunnersSequence,
} from '../proof/caller/runner-state-call.mjs';
import { runDrawWindowList } from '../proof/caller/window-list.mjs';
import {
  raiseMemberStateCountReference,
  restoreAllRunnersReference,
} from '../proof/game-reference/runner-state.mjs';
import { createSide } from './lift-function-harness.mjs';

test('the game and dispatch proof initialize in either import order in a fresh process', () => {
  const entries = ['./src/video/live-game.mjs', './proof/task/native-dispatch.mjs'];
  for (const order of [entries, entries.toReversed()]) {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        order.map((entry) => `await import(${JSON.stringify(entry)})`).join(';'),
      ],
      { encoding: 'utf8', timeout: 30000 },
    );
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  }
});

test('live native targets cover the replay table and reject recorded waits before access', () => {
  assert.deepEqual([...SPECIAL_NATIVES.keys()].sort(), [...replayNatives.keys()].sort());
  for (const target of replayContinuations.keys())
    assert.ok(SPECIAL_NATIVE_CONTINUATIONS.has(target));
  const options = { interruptEvents: { interrupts: Object.freeze([]) } };
  for (const [target, create] of SPECIAL_NATIVE_CONTINUATIONS) {
    assert.throws(() => create(null, options), { reason: 'script_native_lag_free_required' });
    assert.throws(() => SPECIAL_NATIVES.get(target)(null, options), {
      reason: 'script_native_lag_free_required',
    });
  }
});

test('replay registrations retain the live and reference factories for one target', () => {
  const target = 0x80ffff,
    saved = shared.get(target);
  const live = { run() {}, create() {} },
    reference = { run() {}, create() {} };
  try {
    shared.set(target, live);
    NATIVE_CALL_CONTINUATIONS.set(target, reference);
    assert.equal(shared.get(target), reference);
    assert.equal(shared.get(live.run), live);
    assert.equal(shared.get(reference.run), reference);
  } finally {
    if (saved) shared.set(target, saved);
    else shared.delete(target);
    shared.delete(live.run);
    shared.delete(reference.run);
  }
});

test('retained runner resource natives preserve their redraw frame and game state across pauses', () => {
  const saved = shared.get(runDrawWindowList);
  const cases = [
    [raiseStateCountSequence, raiseMemberStateCountReference],
    [restoreRunnersSequence, restoreAllRunnersReference],
  ];
  const redraw = (h) => {
    assert.equal(h.ctx.programBank, 0x81);
    assert.equal(h.ctx.pc, 0xad92);
    h.a.mem.write16(0x7e1d80, 0x5678);
    return h.rtl();
  };
  try {
    shared.set(runDrawWindowList, {
      run: runDrawWindowList,
      create: ({ h }) =>
        new NativeCallContinuation(
          h.a,
          (function* () {
            yield () => redraw(h);
          })(),
        ),
    });
    for (const amount of [0, 1, 10, 255, 65535])
      for (const [sequence, reference] of cases) {
        const make = () => {
          const side = createSide({ seed: 1, wram: new Uint8Array(0x20000) }, new Map());
          Object.assign(side.a.ctx, { programBank: 0x80, bank: 0x80, pc: 0xcecb });
          side.mem.write16(0x7e0002, amount);
          const number = side.mem.read16(0x809700);
          side.mem.write16(0x7e150a, number);
          side.mem.write16(0x7e2df0, number);
          side.mem.write16(0x7e13a8, 0x3000);
          side.h.push(0x1234, 2);
          return side;
        };
        const live = make(),
          original = make();
        const continuation = new NativeCallContinuation(live.a, sequence(live.h, null));
        while (continuation.run(1) === WAIT_PAUSED) {
          /* Resume the same call frame. */
        }
        reference(original.a, null, false, { list: () => redraw(original.h) });
        assert.equal(live.a.ctx.pc, 0x1235);
        assert.equal(live.a.ctx.s, original.a.ctx.s);
        assert.equal(live.a.ctx.programBank, original.a.ctx.programBank);
        // Scratch registers and dead return bytes are outside the game-state contract.
        for (const side of [live, original]) side.mem.wram.fill(0, 0, 0x1ca);
        assert.deepEqual(live.mem.wram, original.mem.wram);
      }
  } finally {
    if (saved) shared.set(runDrawWindowList, saved);
    else shared.delete(runDrawWindowList);
  }
});
