import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import * as liftedPortrait from '../src/game/member-portrait.mjs';
import { memberPortraitJsr } from './register-forms/jsr-forms.mjs';
import { unpackPortraitRoutine } from './register-forms/portrait-routines.mjs';
import { frameWaitCallSequence } from '../src/system/live-input-calls.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
} from '../src/system/native-call-continuation.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';
import {
  MEMBER_PORTRAIT,
  NMI_JOB_LISTS,
  PORTRAIT_DMA_REQUEST,
  PORTRAIT_PALETTE_START,
  HDMAEN_SHADOW,
  RANDOM_STATE,
  PORTRAIT_HDMA_TABLE,
  PORTRAIT_WINDOW_LEFT,
  PORTRAIT_WINDOW_RIGHT,
  TMW_SHADOW,
} from '../src/data/wram.mjs';
import { shiftPortraitRowsJsr } from './register-forms/jsr-forms.mjs';

useLiftVectors(import.meta.url);

// The lifted module with its RTS forms (tools/register-forms/jsr-forms.mjs), named as the former.
const direct = { ...liftedPortrait, memberPortraitSequence: memberPortraitJsr };

function run(module, member, jobs, shadow, budget) {
  const side = textWindowSide(),
    { h, a, mem, put, events } = side;
  h.ctx.s = 0x1eef;
  put(MEMBER_PORTRAIT, member);
  put(NMI_JOB_LISTS, jobs);
  put(HDMAEN_SHADOW, shadow);
  put(RANDOM_STATE, 0xffff);
  let requests = 0,
    frames = 0;
  const snapshot = () => [
    mem.wram[HDMAEN_SHADOW],
    mem.read16(TMW_SHADOW),
    mem.wram.slice(PORTRAIT_HDMA_TABLE, PORTRAIT_HDMA_TABLE + 13),
    mem.wram[PORTRAIT_WINDOW_LEFT],
    mem.wram[PORTRAIT_WINDOW_RIGHT],
  ];
  events.interrupts.textWait = (_h, _events, _status, pc) => {
    if (pc === 0x80901f) {
      requests++;
      side.calls.push([
        'upload',
        mem.read16(PORTRAIT_DMA_REQUEST),
        mem.read16(PORTRAIT_PALETTE_START),
        mem.wram.slice(0x15250, 0x16250),
      ]);
      put(PORTRAIT_DMA_REQUEST, mem.read16(PORTRAIT_DMA_REQUEST) | 0x8000);
    } else {
      assert.equal(pc, 0x81b0a9);
      assert.ok(++frames <= 11);
      // Game state only (user decision 2026-11-17): the window step (X in the original)
      // shows in the window edges, not in a register.
      side.calls.push(['frame', ...snapshot()]);
      put(RANDOM_STATE, mem.read16(RANDOM_STATE) + 1);
    }
    return true;
  };
  const table = new Map([
      [0x809f6d, unpackPortraitRoutine],
      [0x808f20, shiftPortraitRowsJsr],
    ]),
    bindings = [];
  for (const [target, sequence] of [[0x81b0a1, frameWaitCallSequence]]) {
    const run = () => assert.fail('former callee must resume cooperatively');
    table.set(target, run);
    bindings.push(run);
    NATIVE_CALL_CONTINUATIONS.set(run, {
      run,
      create: () => new NativeCallContinuation(a, sequence(h, events, table)),
    });
  }
  try {
    let final;
    function* sequence() {
      const result = yield* module.memberPortraitSequence(h, events, table);
      final = snapshot();
      return result;
    }
    const result = finishTextWindow(side, sequence(), budget);
    result.wram.fill(0, 0x1e80, 0x1ef0);
    return { ...result, final, requests, frames };
  } finally {
    for (const run of bindings) NATIVE_CALL_CONTINUATIONS.delete(run);
  }
}
for (const budget of [1, 7])
  for (const member of [0, 1, 0x4e, 0x4f])
    for (const jobs of [0, 0x7fff, 0xffff])
      for (const shadow of [0, 0xfe])
        test(`member portrait: member ${member}, jobs ${jobs}, shadow ${shadow}, budget ${budget}`, () => {
          const actual = run(direct, member, jobs, shadow, budget);
          assertFrozenRun(actual);
          assert.equal(actual.requests, 2);
          assert.equal(actual.frames, 11);
          assert.equal(actual.final[0], shadow | 1);
          assert.equal(actual.final[1], 15);
          assert.equal(
            actual.wram[NMI_JOB_LISTS] | (actual.wram[NMI_JOB_LISTS + 1] << 8),
            (jobs + 1) & 0xffff,
          );
          assert.deepEqual(
            actual.calls.filter((c) => c[0] === 'upload').map((c) => c.slice(1, 3)),
            [
              [0, 0x91],
              [0x800, 0xa1],
            ],
          );
          // The right edge (step + 39) of the step before each later frame.
          assert.deepEqual(
            actual.calls
              .filter((c) => c[0] === 'frame')
              .slice(1)
              .map((c) => c[5]),
            Array.from({ length: 10 }, (_, n) => 0x39 + 2 + 3 * n),
          );
        });
