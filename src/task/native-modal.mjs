import { withInterruptEvents } from './observed-native-events.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { taskStop } from './plan.mjs';
import { fitListWindow } from '../data/menu-layout.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { f963Sequence } from './native-window-open.mjs';
import { menuComposeSequence } from './native-menu-compose.mjs';
import { releaseWindowJsrSequence } from '../game/window-release.mjs';
import { printTextSequence } from './native-text-compose.mjs';
import { observedContinuation, drainNativeSequence } from './native-call-continuation.mjs';
import { taskActionsDevices } from './native-actions.mjs';
import { fec1Registers, TEXT_NUMBERS } from './native-notice.mjs';
import { DP_PORTRAIT_FRAME } from './native-dialog.mjs';
import {
  NUYEN,
  WRAM,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_MENU_COLUMN,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_LIST_TOKENS,
  DP_LIST_TOKEN_BANK,
} from './wram.mjs';
import { STATE_HOLDER } from '../data/actors.mjs';
import { WORD_MASK, BANK_WRAP, BANK_SIZE, LONG_WRAP } from '../constants/bits.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_CARRY,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
export const modalDevices = Object.freeze(
  Object.fromEntries(
    ['writes', 'reads', 'observationPcs'].map((key) => [
      key,
      Object.freeze([...new Set([...taskActionsDevices[key], ...fec1Registers[key]])]),
    ]),
  ),
);
// Entries: CD43 Yes/No question, CD20 pay nuyen, CBF7 set a state holder, 935B text.
const MODAL_ENTRIES = Object.freeze([0x80cd43, 0x80cd20, 0x80cbf7, 0x80935b]);
// CD43: the question window takes six columns and four rows at the caller's place; the
// menu lists Yes and No (80:CD91, texts 714D/7150, 0 ends) in two visible rows.
const QUESTION_WINDOW = Object.freeze({ columns: 6, rows: 4, visibleRows: 2 }),
  YES_NO_ITEMS = 0x80cd91,
  YES_NO_TEXTS = Object.freeze([0x714d, 0x7150, 0]),
  DP_QUESTION_WINDOW = 0x0e,
  JSR_RETURN_OFFSET = 2,
  JSR_BYTES = 3;
// F963, A6C7, FE69 and FA3E keep their own sequences.
function* modalSequence(a, events, entry, outerReturn) {
  if (
    !MODAL_ENTRIES.includes(entry) ||
    a.ctx.d !== 0 ||
    a.ctx.bank !== CODE_BANK ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_modal_entry_required');
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
      a.pushWord((pc + JSR_RETURN_OFFSET) & WORD_MASK, 'modal-JSR');
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
        Object.freeze({
          pc,
          target,
          rawReturnWord: p.rawReturnWord,
          returnTarget: p.returnTarget,
          outcome: p.outcome,
        }),
      );
    };
    return p;
  };
  if (entry === 0x80cd43) {
    yield () => {
      for (const [offset, n] of [
        [DP_WINDOW_COLUMNS, QUESTION_WINDOW.columns],
        [DP_WINDOW_ROWS, QUESTION_WINDOW.rows],
        [DP_WINDOW_ATTRIBUTES, 0],
      ]) {
        h.load(n);
        h.dpWrite(offset, ctx.a);
      }
    };
    fitListWindow(a.mem, h, YES_NO_TEXTS);
    yield* call(0x80cd52, 0x80f963, function* () {
      const p = yield* f963Sequence(
        a,
        {
          mode: events.mode,
          interruptEvents: events,
          values: Object.freeze((events.values ?? []).slice(events.waitIndex)),
        },
        false,
      );
      yield () => {
        events.waitIndex += p.waitObservationsUsed;
      };
      return p;
    });
    yield () => {
      h.load(h.dp(0));
      h.dpWrite(DP_QUESTION_WINDOW, ctx.a);
      for (const [offset, n] of [
        [DP_MENU_COLUMN, 1],
        [DP_MENU_ROW, 0],
        [DP_MENU_VISIBLE_ROWS, QUESTION_WINDOW.visibleRows],
        [DP_LIST_TOKENS, YES_NO_ITEMS & WORD_MASK],
        [DP_LIST_TOKEN_BANK, CODE_BANK],
      ]) {
        h.load(n);
        h.dpWrite(offset, ctx.a);
      }
    };
    yield* call(0x80cd6f, 0x80a6c7, () => menuComposeSequence(a, events, 0x80a6c7, false));
    yield () => {
      h.load(h.dp(0));
      compare(ctx.a, WORD_MASK);
      let selected = Boolean(ctx.status & FLAG_ZERO);
      if (!selected) {
        compare(ctx.a, 1);
        selected = Boolean(ctx.status & FLAG_ZERO);
      }
      // Actual PEA stores high then low; removal can alias either byte. The
      // original PLA observes the current physical WORD instead of cached choice.
      a.pushWord(selected ? 0 : WORD_MASK, 'CD43-choice-PEA');
      h.load(h.dp(DP_QUESTION_WINDOW));
      h.dpWrite(0, ctx.a);
    };
    yield* call(0x80cd8a, 0x80fa3e, () => releaseWindowJsrSequence(a, events));
    yield () => {
      h.load(a.pullWord('CD43-choice-PLA-fresh'));
      h.dpWrite(0, ctx.a);
    };
  } else if (entry === 0x80cd20) {
    yield () => {
      ctx.status |= FLAG_CARRY;
      h.load(h.read(WRAM + NUYEN));
      h.arithmetic(h.dp(0), true);
      let success = true;
      if (!(ctx.status & FLAG_CARRY)) {
        index('x', ctx.a);
        h.load(h.read(WRAM + NUYEN + 2));
        if (ctx.status & FLAG_ZERO) success = false;
        else {
          h.load((ctx.a - 1) & WORD_MASK);
          h.write(WRAM + NUYEN + 2, ctx.a);
          h.load(ctx.x);
        }
      }
      if (success) {
        h.write(WRAM + NUYEN, ctx.a);
        h.load(WORD_MASK);
        h.dpWrite(0, ctx.a);
      } else h.dpWrite(0, 0);
    };
  } else if (entry === 0x80cbf7) {
    yield () => {
      index('x', h.dp(0));
      h.load(h.read(0x8db020 + ctx.x));
      if (!(ctx.status & FLAG_ZERO)) {
        index('x', ctx.a);
        h.load(h.dp(2));
        h.write(WRAM + STATE_HOLDER + ctx.x, ctx.a);
      }
    };
  } else {
    yield () => {
      h.load(h.dp(0));
      h.asl();
      index('x', ctx.a);
      h.load(h.read(h.abs(TEXT_NUMBERS) + ctx.x));
      h.dpWrite(2, ctx.a);
      h.load(h.dp(DP_PORTRAIT_FRAME));
      h.dpWrite(0, ctx.a);
    };
    yield* call(0x809368, 0x80fe69, () => printTextSequence(a, events, false));
  }
  let result;
  yield () => {
    const rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'modal-root-RTS-fresh',
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
function observedModal(a, options, entry, outerReturn, allowRemaining, lifted = null) {
  const events = withInterruptEvents(
    {
      mode: options.waitMode ?? null,
      values: options.waitObservations ?? null,
      waitIndex: 0,
      waitEvents: [],
      calls: [],
      inputMode: options.inputMode ?? null,
      inputs: options.inputObservations ?? null,
      inputIndex: 0,
    },
    options,
  );
  const view = {
    ...a,
    readWord(address, wrap = LONG_WRAP, label = 'WORD', outer = false) {
      const value = a.readWord(address, wrap, label, outer);
      if (
        address >= YES_NO_ITEMS &&
        address <= YES_NO_ITEMS + 2 * (YES_NO_TEXTS.length - 1) &&
        value !== YES_NO_TEXTS[(address - YES_NO_ITEMS) / 2]
      )
        taskStop('task_modal_original_table_required');
      return value;
    },
  };
  const finish = (p) => {
    if (!allowRemaining && events.waitIndex !== (options.waitObservations?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
    if (!allowRemaining && events.inputIndex !== (options.inputObservations?.length ?? 0))
      taskStop('task_input_observation_unused', { observationIndex: events.inputIndex });
    return {
      ...p,
      calls: Object.freeze(events.calls),
      waitObservationsUsed: events.waitIndex,
      inputObservationsUsed: events.inputIndex,
    };
  };
  const sequence =
    lifted !== null && lagFree(events)
      ? lifted(dialogAccess(a), events)
      : modalSequence(view, events, entry, outerReturn);
  return { sequence, finish };
}
export function runTaskModalObserved(
  a,
  options,
  entry,
  outerReturn = true,
  allowRemaining = false,
  lifted = null,
) {
  const { sequence, finish } = observedModal(
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
export const createModalObserved =
  (entry, lifted = null) =>
  (a, options) =>
    observedContinuation(a, observedModal(a, options, entry, false, false, lifted));
