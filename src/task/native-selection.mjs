import { withInterruptEvents } from './observed-native-events.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { taskStop } from './plan.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { requestWindowUploadSequence } from './native-menu-compose.mjs';
import { setTextCursor } from './native-list-prerequisites.mjs';
import { printTextSequence } from './native-text-compose.mjs';
import { observedContinuation, drainNativeSequence } from './native-call-continuation.mjs';
import { setObjectActionAndDirection } from './native-object-turn.mjs';
import { TEXT_NUMBERS } from './native-notice.mjs';
import { DP_PORTRAIT_FRAME } from './native-dialog.mjs';

import {
  GROUP_INDEX,
  GROUP_NUMBERS,
  OBJECT_NUMBER,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  ROOM,
  WRAM,
  DP_CURSOR_ROW,
} from './wram.mjs';
import { WORD_MASK, BYTE_MASK, BANK_WRAP, BANK_SIZE } from '../constants/bits.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_CARRY,
  FLAG_ZERO,
  FLAG_NEGATIVE,
} from '../constants/cpu-flags.mjs';
import {
  WRMPYA,
  WRMPYB,
  WRDIVL,
  WRDIVH,
  WRDIVB,
  RDDIVL,
  RDMPYL,
  RDMPYH,
} from '../constants/hardware-registers.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
export const selectionDevices = Object.freeze({
  writes: Object.freeze([WRMPYA, WRMPYB, WRDIVL, WRDIVH, WRDIVB]),
  reads: Object.freeze([RDDIVL, RDMPYL, RDMPYH]),
  observationPcs: Object.freeze([0x80facd, 0x81addd, 0x81ae39, 0x81ae73, 0x81ae7d, 0x81ae94]),
});
// Entries 933A (text of the topic menu) and BBA0 (turn a member to the room direction).
const SELECTION_ENTRIES = Object.freeze([0x80933a, 0x80bba0]);
// BBA0: byte 2 of the 9-byte room record (8D:929D + 9 room) is a direction, turned by one
// for the second member and back by one for the third (group index 2 and 4), masked to
// eight; selection_steps_x/y 80:BBFA/BC0A give the steps; D15C then sets action 2.
const ROOM_RECORD_SHIFT = 3,
  DP_ROOM_DIRECTION = 0xa2,
  SECOND_MEMBER_INDEX = 2,
  THIRD_MEMBER_INDEX = 4,
  DIRECTION_COUNT_MASK = 7,
  DP_SELECTION_DIRECTION = 4,
  SELECTION_STEPS_X = 0xbbfa,
  SELECTION_STEPS_Y = 0xbc0a,
  SELECTION_ACTION = 2,
  JSR_RETURN_OFFSET = 2,
  JSR_BYTES = 3;
// The original selection_steps_x/y words the port checks before using them.
const SELECTION_STEP_WORDS = Object.freeze([
  0, 4, 4, 4, 0, 65532, 65532, 65532, 4, 4, 0, 65532, 65532, 65532, 0, 4,
]);
// Fixed original equations and fresh physical return frames on one owner.
// FA67 and FE69 keep their own sequences; FAAC and D15C stay single segments.
function* selectionSequence(a, events, entry, outerReturn) {
  if (
    !SELECTION_ENTRIES.includes(entry) ||
    a.ctx.d !== 0 ||
    a.ctx.bank !== CODE_BANK ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_selection_root_entry_required');
  const h = taskTextAccess(a),
    { ctx } = h,
    index = (name, value) => {
      ctx[name] = h.nz(value, 2);
    };
  const compare = (left, right) => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
    h.nz((left - right) & WORD_MASK, 2);
  };
  const call = function* (pc, target, body) {
    yield () => {
      a.pushWord((pc + JSR_RETURN_OFFSET) & WORD_MASK, 'selection-root-JSR');
      ctx.pc = target & WORD_MASK;
    };
    const p = yield* body();
    yield () => {
      if (
        p.rawReturnWord !== ((pc + JSR_RETURN_OFFSET) & WORD_MASK) ||
        ctx.pc !== ((pc + JSR_BYTES) & WORD_MASK) ||
        ctx.programBank !== CODE_BANK ||
        ctx.bank !== CODE_BANK ||
        ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
      )
        taskStop('task_native_helper_return_required', {
          pc,
          raw: p.rawReturnWord,
          returnTarget: p.returnTarget,
        });
      events.calls.push(
        Object.freeze({ pc, target, rawReturnWord: p.rawReturnWord, returnTarget: p.returnTarget }),
      );
    };
    return p;
  };
  const segment = function* (run) {
    let result;
    yield () => {
      result = run();
    };
    return result;
  };
  if (entry === 0x80933a) {
    yield () => {
      h.load(h.dp(0));
      a.pushWord(ctx.a, '933A-selector-PHA');
      h.load(h.dp(DP_PORTRAIT_FRAME));
      h.dpWrite(0, ctx.a);
    };
    yield* call(0x809341, 0x80fa67, () => requestWindowUploadSequence(a, events, false));
    yield () => {
      h.dpWrite(2, 0);
      h.dpWrite(DP_CURSOR_ROW, 0);
    };
    yield* call(0x809348, 0x80faac, () => segment(() => setTextCursor(a, events, false)));
    yield () => {
      h.load(a.pullWord('933A-selector-PLA-fresh'));
      h.asl();
      index('x', ctx.a);
      h.load(h.read(h.abs(TEXT_NUMBERS) + ctx.x));
      h.dpWrite(2, ctx.a);
      h.load(h.dp(DP_PORTRAIT_FRAME));
      h.dpWrite(0, ctx.a);
    };
    yield* call(0x809357, 0x80fe69, () => printTextSequence(a, events, false));
  } else {
    yield () => {
      h.load(h.read(WRAM + ROOM));
      for (let n = 0; n < ROOM_RECORD_SHIFT; n++) h.asl();
      h.arithmetic(h.read(WRAM + ROOM));
      index('x', ctx.a);
      h.load(h.read(0x8d929f + ctx.x));
      h.load(ctx.a & BYTE_MASK);
      h.dpWrite(DP_ROOM_DIRECTION, ctx.a);
      h.load(h.read(WRAM + GROUP_INDEX));
      index('x', ctx.a);
      index('y', h.dp(0));
      h.load(h.read(h.abs(OBJECT_NUMBER) + ctx.y));
      for (;;) {
        compare(ctx.a, h.read(WRAM + GROUP_NUMBERS + ctx.x));
        if (ctx.status & FLAG_ZERO) break;
        index('x', (ctx.x - 1) & WORD_MASK);
        index('x', (ctx.x - 1) & WORD_MASK);
        if (ctx.status & FLAG_NEGATIVE) break;
      }
      h.load(h.dp(DP_ROOM_DIRECTION));
      compare(ctx.x, SECOND_MEMBER_INDEX);
      if (ctx.status & FLAG_ZERO) h.load((ctx.a + 1) & WORD_MASK);
      else {
        compare(ctx.x, THIRD_MEMBER_INDEX);
        if (ctx.status & FLAG_ZERO) h.load((ctx.a - 1) & WORD_MASK);
      }
      h.load(ctx.a & DIRECTION_COUNT_MASK);
      h.dpWrite(DP_SELECTION_DIRECTION, ctx.a);
      h.asl();
      index('x', ctx.a);
      for (const [table, field] of [
        [SELECTION_STEPS_X, OBJECT_VELOCITY_X],
        [SELECTION_STEPS_Y, OBJECT_VELOCITY_Y],
      ]) {
        const value = h.read(h.abs(table) + ctx.x);
        if (value !== SELECTION_STEP_WORDS[(table - SELECTION_STEPS_X + ctx.x) / 2])
          taskStop('task_selection_direction_table_required');
        h.load(value);
        h.write(h.abs(field) + ctx.y, ctx.a);
      }
      h.load(SELECTION_ACTION);
      h.dpWrite(2, ctx.a);
    };
    yield* call(0x80bbf6, 0x80d15c, () => segment(() => setObjectActionAndDirection(a, false)));
  }
  let result;
  yield () => {
    const rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'selection-root-RTS-fresh',
      outerReturn,
    );
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = {
      rawReturnWord,
      returnTarget: ctx.programBank * BANK_SIZE + ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
      fullTaskBinding: false,
    };
  };
  return result;
}
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits replay the register-level native.
function observedSelection(a, options, entry, outerReturn, allowRemaining, lifted = null) {
  const events = withInterruptEvents(
    {
      mode: options.waitMode ?? null,
      values: options.waitObservations ?? null,
      waitIndex: 0,
      calls: [],
    },
    options,
  );
  const finish = (p) => {
    if (!allowRemaining && events.waitIndex !== (options.waitObservations?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
    if (!allowRemaining && (options.inputObservations?.length ?? 0))
      taskStop('task_input_observation_unused', { observationIndex: 0 });
    return { ...p, calls: Object.freeze(events.calls), waitObservationsUsed: events.waitIndex };
  };
  const sequence =
    lifted !== null && lagFree(events)
      ? lifted(dialogAccess(a), events)
      : selectionSequence(a, events, entry, outerReturn);
  return { sequence, finish };
}
export function runTaskSelectionObserved(
  a,
  options,
  entry,
  outerReturn = true,
  allowRemaining = false,
  lifted = null,
) {
  const { sequence, finish } = observedSelection(
    a,
    options,
    entry,
    outerReturn,
    allowRemaining,
    lifted,
  );
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createSelectionObserved =
  (entry, lifted = null) =>
  (a, options) =>
    observedContinuation(a, observedSelection(a, options, entry, false, false, lifted));
