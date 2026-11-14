import { withInterruptEvents } from './observed-native-events.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { dialogTextSequences } from './native-dialog-text.mjs';
import {
  observedContinuation,
  drainNativeSequence,
  dialogCallBody,
  segmentSequence,
} from './native-call-continuation.mjs';
import { validateGloveTaskOptions } from './native-glove-target.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { TEXT_NUMBERS } from './native-notice.mjs';
import {
  SPELL_LIST,
  WRAM,
  SPELL_CHOICE_HEADER,
  SPELL_CHOICE_NAMES,
  DP_WINDOW_LEFT,
  DP_WINDOW_TOP,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_MENU_COLUMN,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_LIST_TOKENS,
  DP_LIST_TOKEN_BANK,
} from './wram.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { WORD_MASK, BANK_WRAP, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { CODE_BANK, CODE_BANK_BASE, WRAM_BANK } from '../constants/memory-map.mjs';

// E1CF: window 0E/05/10/07 (kept in DP0E) and a menu of five visible rows; the list loop
// stops the port after 8000 entries (no original bound).
export const SPELL_WINDOW = Object.freeze({
    left: 0x0e,
    top: 5,
    columns: 0x10,
    rows: 7,
    visibleRows: 5,
  }),
  DP_SPELL_WINDOW = 0x0e,
  LIST_ENTRY_LIMIT = WORD_SIGN;
// 80:E1CF: let the player choose a spell. With spells in the word list 7E3C1C (0 ends it): window 0E/05/10/07 over
// F963 (number to DP0E), names D9B8+2*id to the list 1D75 (0 ends it, header 1D73 = 7088), menu A6C7
// (DP02 1, DP04 0, DP06 5, list 7E:1D73); a choice n > 0 gives the spell 7E3C1C+2(n-1), else 0. In
// every case FA3E releases window DP0E (without spells the original releases the unset DP0E) and the
// pushed result goes to DP00. Waits and the joypad are observations as in the dialog.
export function chooseSpell(a, events, outerReturn = true, routines = null) {
  return drainNativeSequence(e1cfSequence(a, events, outerReturn, routines));
}
// Without replacement routines F963, A6C7 and FA3E run as their own sequences.
function* e1cfSequence(a, events, outerReturn, routines = null) {
  if (
    a.ctx.d !== 0 ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_e1cf_entry_required');
  const h = dialogAccess(a),
    { ctx } = h,
    sequences = dialogTextSequences(events);
  const call = (pc, target, name) =>
    dialogCallBody(h, pc, target, () =>
      routines === null ? sequences[name](h.a) : segmentSequence(() => routines[name](h.a)),
    );
  let chosen = false,
    spells;
  yield () => {
    h.load(h.read(WRAM + SPELL_LIST));
    spells = !(ctx.status & FLAG_ZERO);
    if (spells)
      for (const [o, v] of [
        [DP_WINDOW_LEFT, SPELL_WINDOW.left],
        [DP_WINDOW_TOP, SPELL_WINDOW.top],
        [DP_WINDOW_COLUMNS, SPELL_WINDOW.columns],
        [DP_WINDOW_ROWS, SPELL_WINDOW.rows],
        [DP_WINDOW_ATTRIBUTES, 0],
      ]) {
        h.load(v);
        h.dpWrite(o, ctx.a);
      }
  };
  if (spells) {
    if (a.mem?.language) {
      const ids = listTextIds(a.mem, WRAM + SPELL_LIST, LIST_ENTRY_LIMIT).map((number) =>
        a.mem.read16(CODE_BANK_BASE | (TEXT_NUMBERS + 2 * number)),
      );
      fitListWindow(a.mem, h, [TEXT_EXIT, ...ids]);
    }
    yield* call(0x80e1ee, 0x80f963, 'allocate');
    yield () => {
      h.load(h.dp(0));
      h.dpWrite(DP_SPELL_WINDOW, ctx.a);
      h.index('x', 0);
      for (let n = 0; ; n++) {
        if (n === LIST_ENTRY_LIMIT) taskStop('task_native_e1cf_list_unbounded');
        h.load(h.read(WRAM + SPELL_LIST + ctx.x));
        if (ctx.status & FLAG_ZERO) break;
        h.asl();
        h.index('y', ctx.a);
        h.load(h.read(h.abs(TEXT_NUMBERS) + ctx.y));
        h.write(h.abs(SPELL_CHOICE_NAMES) + ctx.x, ctx.a);
        h.index('x', ctx.x + 1);
        h.index('x', ctx.x + 1);
      }
      h.write(h.abs(SPELL_CHOICE_NAMES) + ctx.x, 0);
      h.load(TEXT_EXIT);
      h.write(h.abs(SPELL_CHOICE_HEADER), ctx.a);
      h.load(1);
      h.dpWrite(DP_MENU_COLUMN, ctx.a);
      h.dpWrite(DP_MENU_ROW, 0);
      for (const [o, v] of [
        [DP_MENU_VISIBLE_ROWS, SPELL_WINDOW.visibleRows],
        [DP_LIST_TOKENS, SPELL_CHOICE_HEADER],
        [DP_LIST_TOKEN_BANK, WRAM_BANK],
      ]) {
        h.load(v);
        h.dpWrite(o, ctx.a);
      }
    };
    yield* call(0x80e229, 0x80a6c7, 'menu');
    yield () => {
      h.load(h.dp(0));
      h.cmp(WORD_MASK);
      if (!(ctx.status & FLAG_ZERO)) {
        h.asl();
        if (!(ctx.status & FLAG_ZERO)) {
          h.load((ctx.a - 1) & WORD_MASK);
          h.load((ctx.a - 1) & WORD_MASK);
          h.index('x', ctx.a);
          h.load(h.read(WRAM + SPELL_LIST + ctx.x));
          h.pha();
          chosen = true;
        }
      }
    };
  }
  yield () => {
    if (!chosen) h.push(0, 2); // PEA $0000
    h.load(h.dp(DP_SPELL_WINDOW));
    h.dpWrite(0, ctx.a);
  };
  yield* call(0x80e247, 0x80fa3e, 'release');
  let result;
  yield () => {
    h.pla();
    h.dpWrite(0, ctx.a);
    const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'E1CF-RTS', outerReturn);
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = {
      rawReturnWord,
      returnTarget: CODE_BANK_BASE | ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
      scope: 'manual-source-specific-native-e1cf',
    };
  };
  return result;
}
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits and inputs replay the register-level
// native.
function observeChooseSpell(a, options, outerReturn, lifted = null) {
  const invalid = validateGloveTaskOptions(options);
  if (invalid) taskStop(invalid.reason);
  const events = withInterruptEvents(
    {
      mode: 'record-observations',
      values: options?.waitObservations ?? null,
      waitIndex: 0,
      calls: [],
      waitEvents: [],
      inputMode: 'record-observations',
      inputs: options?.inputObservations ?? null,
      inputIndex: 0,
    },
    options,
  );
  const finish = (result) => {
    if (events.waitIndex !== (events.values?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
    if (events.inputIndex !== (events.inputs?.length ?? 0))
      taskStop('task_input_observation_unused', { observationIndex: events.inputIndex });
    return {
      ...result,
      waitObservationsUsed: events.waitIndex,
      inputObservationsUsed: events.inputIndex,
    };
  };
  if (lifted !== null && lagFree(events))
    return { sequence: liftedResult(lifted(dialogAccess(a), events)), finish };
  return { sequence: e1cfSequence(a, events, outerReturn), finish };
}
function* liftedResult(sequence) {
  return { rawReturnWord: yield* sequence };
}
export function chooseSpellObserved(a, options, outerReturn = true, lifted = null) {
  const { sequence, finish } = observeChooseSpell(a, options, outerReturn, lifted);
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createChooseSpellObserved = (a, options, lifted = null) =>
  observedContinuation(a, observeChooseSpell(a, options, false, lifted));
