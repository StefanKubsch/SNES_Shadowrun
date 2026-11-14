import { withInterruptEvents } from './observed-native-events.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { f963Sequence } from './native-window-open.mjs';
import { printTextSequence } from './native-text-compose.mjs';
import { fitNoticeWindow } from '../data/language.mjs';
import { releaseWindowJsrSequence } from '../game/window-release.mjs';
import {
  observedContinuation,
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from './native-call-continuation.mjs';
import { WORD_MASK, BANK_WRAP, BANK_SIZE, LONG_MASK } from '../constants/bits.mjs';
import {
  WRAM,
  NOTICE_WINDOWS,
  NOTICE_WINDOW_LAST,
  NOTICE_FRAMES,
  NOTICE_EFFECT_FRAMES,
  DP_WINDOW_ATTRIBUTES,
  DP_NOTICE_TEXT,
  DP_NOTICE_FRAMES,
} from './wram.mjs';
import {
  FLAG_CARRY,
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
} from '../constants/cpu-flags.mjs';
import {
  M7A,
  M7B,
  WRMPYA,
  WRMPYB,
  WRDIVL,
  WRDIVH,
  WRDIVB,
  MPYL,
  MPYM,
  RDDIVL,
  RDDIVH,
  RDMPYL,
  RDMPYH,
} from '../constants/hardware-registers.mjs';
const devices = Object.freeze({
  writes: Object.freeze([M7A, M7B, WRMPYA, WRMPYB, WRDIVL, WRDIVH, WRDIVB]),
  reads: Object.freeze([MPYL, MPYM, RDDIVL, RDDIVH, RDMPYL, RDMPYH]),
  observationPcs: Object.freeze([
    0x80fa01, 0x80fa19, 0x81addd, 0x81ae39, 0x81ae73, 0x81ae7d, 0x81ae94, 0x81af56, 0x81af73,
    0x81afc9, 0x81afce, 0x81afec, 0x81b009, 0x81b016,
  ]),
});
export { devices as fec1Registers };
// Text pointers by number (src/data/tables.mjs text_numbers 80:D9B8).
export const TEXT_NUMBERS = 0xd9b8;
// A notice window with these attributes starts 30 frames of the random effect.
const NOTICE_EFFECT_ATTRIBUTES = 0x400,
  NOTICE_EFFECT_DURATION = 30;
// Window wait loops of the notice (81:ACAF/ACBD/ACC3/ACC9).
const NOTICE_WAIT_PCS = Object.freeze([0x81acbd, 0x81acaf, 0x81acc3, 0x81acc9]);
// 80:FEC1: show a notice window with a text. Whole original graph. Actual source-specific calls run over one
// existing Task owner; no dispatch/CPU, device calculation or inner commit.
// F963, FE69 and FA3E keep their own sequences, so their waits can pause here.
// routines (optional) replaces F963 and FE69 by table entries that end with their RTS,
// as the function test of the lifted notice (src/game/notice-show.mjs) does.
export function showNotice(a, events, outerReturn = true, routines = null) {
  return drainNativeSequence(showNoticeSequence(a, events, outerReturn, routines));
}
export function* showNoticeSequence(a, events, outerReturn, routines = null) {
  const h = taskTextAccess(a),
    { ctx } = h;
  let visits = 0,
    replaced = false;
  const calls = [];
  const index = (name, value) => {
    ctx[name] = h.nz(value, 2);
  };
  const compare = (left, right) => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    h.nz((left - right) & WORD_MASK, 2);
  };
  const call = function* (at, next, target, body) {
    let bank;
    yield () => {
      bank = ctx.programBank;
      a.pushWord((next - 1) & WORD_MASK, 'FEC1-inner-JSR');
      ctx.pc = target & WORD_MASK;
    };
    const result = yield* body();
    yield () => {
      if (
        result.rawReturnWord !== ((next - 1) & WORD_MASK) ||
        ctx.programBank !== bank ||
        ctx.pc !== (next & WORD_MASK)
      )
        taskStop('task_native_helper_return_required', {
          at,
          raw: result.rawReturnWord,
          bank: ctx.programBank,
          pc: ctx.pc,
        });
      calls.push(Object.freeze({ at, target, result }));
    };
    return result;
  };
  const tableBody = (target, body) =>
    routines?.has(target)
      ? function* () {
          let rawReturnWord;
          yield () => {
            rawReturnWord = routines.get(target)(dialogAccess(a), events);
          };
          return { rawReturnWord };
        }
      : body;
  yield () => {
    // Text language (src/data/language.mjs): the window size for the translated text.
    fitNoticeWindow(
      a.mem,
      (offset) => h.dp(offset, 2),
      (offset, value) => h.dpWrite(offset, value, 2),
    );
    h.load(h.dp(DP_WINDOW_ATTRIBUTES));
    compare(ctx.a, NOTICE_EFFECT_ATTRIBUTES);
    if (ctx.status & FLAG_ZERO) {
      h.load(NOTICE_EFFECT_DURATION);
      h.write(h.abs(NOTICE_EFFECT_FRAMES), ctx.a);
    }
  };
  const allocated = yield* call(
    0x80fece,
    0x80fed1,
    0x80f963,
    tableBody(0x80f963, function* () {
      const values =
        events.values == null ? null : Object.freeze(events.values.slice(events.waitIndex));
      const result = yield* f963Sequence(
        a,
        { mode: events.mode, interruptEvents: events, values },
        false,
      );
      yield () => {
        events.waitIndex += result.waitObservationsUsed;
      };
      return result;
    }),
  );
  yield () => {
    h.load(h.dp(0));
    a.pushWord(ctx.a, 'FEC1-allocation-PHA');
    h.load(h.dp(DP_NOTICE_TEXT));
    h.asl();
    index('x', ctx.a);
    h.load(h.read(h.abs(TEXT_NUMBERS) + ctx.x));
    h.dpWrite(2, ctx.a);
  };
  const text = yield* call(
    0x80fedd,
    0x80fee0,
    0x80fe69,
    tableBody(0x80fe69, () => printTextSequence(a, events, false)),
  );
  let replace;
  yield () => {
    index('x', NOTICE_WINDOW_LAST);
    h.load(WORD_MASK);
    replace = false;
    for (;;) {
      visits++;
      a.pushWord(ctx.a, 'FEC1-minimum-PHA');
      h.load(h.read(WRAM + NOTICE_WINDOWS + ctx.x));
      if (ctx.status & FLAG_NEGATIVE) break;
      h.load(a.pullWord('FEC1-minimum-PLA-fresh'));
      compare(ctx.a, h.read(h.abs(NOTICE_FRAMES) + ctx.x));
      if (ctx.status & FLAG_CARRY) {
        h.load(h.read(h.abs(NOTICE_FRAMES) + ctx.x));
        index('y', ctx.x);
      }
      index('x', (ctx.x - 1) & WORD_MASK);
      index('x', (ctx.x - 1) & WORD_MASK);
      if (!(ctx.status & FLAG_NEGATIVE)) continue;
      a.pushWord(ctx.a, 'FEC1-final-minimum-PHA');
      index('x', ctx.y);
      h.load(h.read(WRAM + NOTICE_WINDOWS + ctx.x));
      h.dpWrite(0, ctx.a);
      a.pushWord(ctx.x, 'FEC1-slot-PHX');
      replace = true;
      break;
    }
  };
  if (replace) {
    yield* call(0x80ff04, 0x80ff07, 0x80fa3e, () => releaseWindowJsrSequence(a, events));
    yield () => {
      index('x', a.pullWord('FEC1-slot-PLX-fresh'));
      replaced = true;
    };
  }
  let result;
  yield () => {
    h.load(h.dp(DP_NOTICE_FRAMES));
    h.write(h.abs(NOTICE_FRAMES) + ctx.x, ctx.a);
    h.load(a.pullWord('FEC1-final-minimum-PLA-fresh'));
    h.load(a.pullWord('FEC1-allocation-PLA-fresh'));
    h.write(WRAM + NOTICE_WINDOWS + ctx.x, ctx.a);
    if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) taskStop('task_text_word_mode_required');
    const rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'FEC1-outer-RTS-fresh',
      outerReturn,
    );
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = {
      rawReturnWord,
      returnTarget: ctx.programBank * BANK_SIZE + ctx.pc,
      frontier: 'observed-outer-RTS-target',
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      scope: 'manual-source-specific-notice-full-graph',
      outcome: replaced ? 'notice_replaced' : 'notice_inserted',
      allocation: ctx.a,
      slot: ctx.x,
      visits,
      allocated,
      text,
      calls: Object.freeze(calls),
    };
  };
  return result;
}
export const showNoticeAdapter = (h, e) => showNotice(h.a, e, false);
NATIVE_CALL_CONTINUATIONS.set(0x80fec1, {
  run: showNoticeAdapter,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, showNoticeSequence(h.a, events, false)),
});
export function validateNoticeOptions(options) {
  const { waitMode = null, waitObservations = null } = options ?? {};
  if (waitMode !== null && waitMode !== 'record-observations')
    return { handled: false, reason: 'task_wait_mode_required' };
  if (
    waitObservations !== null &&
    (!Array.isArray(waitObservations) ||
      !Object.isFrozen(waitObservations) ||
      !Array.from(waitObservations).every(
        (o) =>
          o &&
          Object.isFrozen(o) &&
          NOTICE_WAIT_PCS.includes(o.pc) &&
          Number.isInteger(o.address) &&
          o.address >= 0 &&
          o.address <= LONG_MASK &&
          o.width === 2 &&
          Number.isInteger(o.value) &&
          o.value >= 0 &&
          o.value <= WORD_MASK,
      ))
  )
    return { handled: false, reason: 'task_wait_observations_required' };
  return null;
}
// lifted (optional): the lifted notice's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits replay the register-level notice.
function observeShowNotice(a, options, outerReturn, allowRemainingWaitObservations, lifted = null) {
  const invalid = validateNoticeOptions(options);
  if (invalid) {
    const { handled, ...boundary } = invalid;
    taskStop(boundary.reason, boundary);
  }
  const { waitMode = null, waitObservations = null } = options ?? {};
  const events = withInterruptEvents(
    { mode: waitMode, values: waitObservations, waitIndex: 0, calls: [], waitEvents: [] },
    options,
  );
  const finish = (result) => {
    if (!allowRemainingWaitObservations && events.waitIndex !== (waitObservations?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
    return {
      ...result,
      textCalls: Object.freeze(events.calls),
      waitObservationsUsed: events.waitIndex,
      waitEvents: Object.freeze((waitObservations ?? []).slice(0, events.waitIndex)),
    };
  };
  const sequence =
    lifted !== null && lagFree(events)
      ? lifted(dialogAccess(a), events)
      : showNoticeSequence(a, events, outerReturn);
  return { sequence, finish };
}
export function showNoticeObserved(
  a,
  options,
  outerReturn = true,
  allowRemainingWaitObservations = false,
  lifted = null,
) {
  const { sequence, finish } = observeShowNotice(
    a,
    options,
    outerReturn,
    allowRemainingWaitObservations,
    lifted,
  );
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export function createShowNoticeObserved(a, options, lifted = null) {
  return observedContinuation(a, observeShowNotice(a, options, false, false, lifted));
}
