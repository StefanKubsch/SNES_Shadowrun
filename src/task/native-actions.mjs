import {
  ACTION_MENU_NAMES,
  ACTION_MENU_HOTKEYS,
  ACTION_MENU_FLAGS,
  ACTION_MENU_OVERRIDE,
  DP_ACTION_MENU_MASK,
  DP_ACTION_MENU_WINDOW,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_LIST_TOKENS,
  DP_LIST_TOKEN_BANK,
  DP_LIST_VALUES,
} from './wram.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { M7A, M7B, MPYL, MPYM } from '../constants/hardware-registers.mjs';
import { withInterruptEvents } from './observed-native-events.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';
import { f963Sequence } from './native-window-open.mjs';
import { menuComposeSequence, taskMenuDevices } from './native-menu-compose.mjs';
import { releaseWindowJsrSequence } from '../game/window-release.mjs';
import { af1fRegisters } from './native-bar-tiles.mjs';
import {
  observedContinuation,
  drainNativeSequence,
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
} from './native-call-continuation.mjs';
import { BANK_WRAP, WORD_MASK, BANK_SIZE, WORD_BITS, LONG_MASK } from '../constants/bits.mjs';
import {
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_ZERO,
  FLAG_CARRY,
} from '../constants/cpu-flags.mjs';
import { CODE_BANK, WRAM_BANK } from '../constants/memory-map.mjs';

const JSR_BYTES = 3;
// Masks and text pointers in the pinned 99EB source. Original text ids are
// offsets from 9D:8000 (assets/vm-texts.json), including their hotkey glyphs.
const ACTION_FLAGS = Object.freeze({
  examine: 0x80,
  pickup: 0x10,
  talk: 2,
  buy: 0x20,
  give: 0x40,
  use: 0x100,
  open: 0x200,
  close: 0x400,
  castSpell: 0x600,
  target: 0x2000,
  moveTo: 0x4000,
});
const ACTION_TEXT = Object.freeze({
  examine: 0x70d9,
  pickup: 0x70c5,
  talk: 0x708c,
  buy: 0x70d1,
  give: 0x70d4,
  use: 0x70e3,
  castSpell: 0x7109,
  open: 0x70e6,
  close: 0x70f1,
  target: 0x70fd,
  moveTo: 0x7103,
});
const EXAMINE_HOTKEY = 0x20,
  PICKUP_OPEN_CLOSE_HOTKEY = 0x10;
// CPY #3 requires at least one optional word after the mandatory Exit row.
// It remains the literal gate of the original, including odd index values.
const ACTION_OPTION_INDEX_GATE = 3;
const ACTION_WINDOW_LEFT = 12,
  ACTION_WINDOW_TOP = 3,
  ACTION_WINDOW_COLUMNS = 11,
  ACTION_VISIBLE_ROWS = 8;

const entries = [0x8099eb, 0x809ba0];
export const taskActionsDevices = Object.freeze({
  writes: Object.freeze([
    ...new Set([...taskMenuDevices.writes, ...af1fRegisters.writes, M7A, M7B]),
  ]),
  reads: Object.freeze([
    ...new Set([...taskMenuDevices.reads, ...af1fRegisters.reads, MPYL, MPYM]),
  ]),
  observationPcs: Object.freeze([
    ...new Set([
      ...taskMenuDevices.observationPcs,
      ...af1fRegisters.observationPcs,
      0x80fa01,
      0x80fa19,
    ]),
  ]),
});
function runTaskNativeActions(a, events, entry, outerReturn = true, routines = null) {
  return drainNativeSequence(actionsSequence(a, events, entry, outerReturn, routines));
}
// 80:99EB with an optional table that replaces F963 and A6A5 by entries that end with
// their RTS, as the function test of the lifted menu (src/game/action-menu.mjs) does.
export const chooseAction = (a, events, routines = null) =>
  runTaskNativeActions(a, events, 0x8099eb, false, routines);
// The window allocation F963, the menu A6A5 and the release FA3E keep their own
// sequences in their real JSR frames; the code between two calls stays one piece.
function* actionsSequence(a, events, entry, outerReturn, routines = null) {
  if (!entries.includes(entry) || a.ctx.programBank !== CODE_BANK)
    taskStop('task_actions_entry_required');
  const h = taskTextAccess(a),
    { ctx } = h;
  const index = (value) => {
    ctx.y = h.nz(value, 2);
  };
  const finish = (outer) => {
    if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) taskStop('task_text_word_mode_required');
    const rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'actions-return-WORD',
      outer,
    );
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    return {
      rawReturnWord,
      returnTarget: ctx.programBank * BANK_SIZE + ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
    };
  };
  const call = function* (pc, target, body, role) {
    let bank;
    yield () => {
      bank = ctx.programBank;
      a.pushWord((pc + 2) & WORD_MASK, 'actions-JSR-return');
      ctx.programBank = target >>> WORD_BITS;
      ctx.pc = target & WORD_MASK;
    };
    const result = yield* body();
    yield () => {
      if (
        result.rawReturnWord !== ((pc + 2) & WORD_MASK) ||
        ctx.programBank !== bank ||
        ctx.pc !== ((pc + JSR_BYTES) & WORD_MASK)
      )
        taskStop('task_native_helper_return_required', {
          pc,
          raw: result.rawReturnWord,
          bank: ctx.programBank,
          target: result.returnTarget,
        });
      if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
        taskStop('task_text_word_mode_required');
      events.calls.push(
        Object.freeze({
          pc,
          target,
          role,
          rawReturnWord: result.rawReturnWord,
          returnTarget: result.returnTarget,
          outcome: result.outcome,
        }),
      );
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
          return { rawReturnWord, returnTarget: ctx.programBank * BANK_SIZE + ctx.pc };
        }
      : body;
  const actions = function* () {
    h.dpWrite(DP_ACTION_MENU_MASK, ctx.a);
    h.load(h.read(h.abs(ACTION_MENU_OVERRIDE)));
    if (ctx.a !== 0) h.dpWrite(DP_ACTION_MENU_MASK, ctx.a);
    h.load(TEXT_EXIT);
    h.write(h.abs(ACTION_MENU_NAMES), ctx.a);
    h.write(h.abs(ACTION_MENU_FLAGS), 0);
    h.write(h.abs(ACTION_MENU_HOTKEYS), 0);
    index(2);
    h.load(h.dp(DP_ACTION_MENU_MASK));
    const append = (token, flag, hotkey) => {
      h.load(token);
      h.write(h.abs(ACTION_MENU_NAMES) + ctx.y, ctx.a);
      h.load(flag);
      h.write(h.abs(ACTION_MENU_FLAGS) + ctx.y, ctx.a);
      h.load(hotkey);
      h.write(h.abs(ACTION_MENU_HOTKEYS) + ctx.y, ctx.a);
      index((ctx.y + 1) & WORD_MASK);
      index((ctx.y + 1) & WORD_MASK);
      h.load(h.dp(DP_ACTION_MENU_MASK));
    };
    const option = (mask, token, hotkey) => {
      ctx.status = (ctx.status & ~FLAG_ZERO) | (ctx.a & mask ? 0 : FLAG_ZERO);
      if (!(ctx.status & FLAG_ZERO)) append(token, mask, hotkey);
    };
    // Fixed original option order; every successful append refetches DP65.
    for (const [mask, token, key] of [
      [ACTION_FLAGS.examine, ACTION_TEXT.examine, EXAMINE_HOTKEY],
      [ACTION_FLAGS.pickup, ACTION_TEXT.pickup, PICKUP_OPEN_CLOSE_HOTKEY],
      [ACTION_FLAGS.talk, ACTION_TEXT.talk, 0],
      [ACTION_FLAGS.buy, ACTION_TEXT.buy, 0],
      [ACTION_FLAGS.give, ACTION_TEXT.give, 0],
      [ACTION_FLAGS.use, ACTION_TEXT.use, 0],
    ])
      option(mask, token, key);
    h.load(ctx.a & ACTION_FLAGS.castSpell);
    h.compare(ctx.a, ACTION_FLAGS.castSpell);
    if (ctx.status & FLAG_ZERO) append(ACTION_TEXT.castSpell, ACTION_FLAGS.castSpell, 0);
    else {
      h.load(h.dp(DP_ACTION_MENU_MASK));
      option(ACTION_FLAGS.open, ACTION_TEXT.open, PICKUP_OPEN_CLOSE_HOTKEY);
      option(ACTION_FLAGS.close, ACTION_TEXT.close, PICKUP_OPEN_CLOSE_HOTKEY);
    }
    option(ACTION_FLAGS.target, ACTION_TEXT.target, 0);
    option(ACTION_FLAGS.moveTo, ACTION_TEXT.moveTo, 0);
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(ctx.y >= ACTION_OPTION_INDEX_GATE);
    h.nz((ctx.y - ACTION_OPTION_INDEX_GATE) & WORD_MASK, 2);
    if (!(ctx.status & FLAG_CARRY)) {
      h.load(0);
      return {
        ...finish(entry === 0x8099eb ? outerReturn : false),
        outcome: 'no_optional_actions',
        optionCount: 1,
      };
    }
    const optionCount = ctx.y >>> 1;
    h.load(0);
    h.write(h.abs(ACTION_MENU_NAMES) + ctx.y, ctx.a);
    h.load(ctx.y);
    h.lsr();
    h.arithmetic(2);
    h.dpWrite(DP_WINDOW_ROWS, ctx.a);
    for (const [offset, value] of [
      [0, ACTION_WINDOW_LEFT],
      [2, ACTION_WINDOW_TOP],
      [DP_WINDOW_COLUMNS, ACTION_WINDOW_COLUMNS],
      [DP_WINDOW_ATTRIBUTES, 0],
    ]) {
      h.load(value);
      h.dpWrite(offset, ctx.a);
    }
    fitListWindow(
      a.mem,
      h,
      a.mem?.language ? listTextIds(a.mem, h.abs(ACTION_MENU_NAMES), optionCount) : [],
    );
    const allocation = yield* call(
      0x809b5b,
      0x80f963,
      tableBody(0x80f963, function* () {
        const result = yield* f963Sequence(
          a,
          {
            mode: events.mode,
            interruptEvents: events,
            values: Object.freeze(events.values?.slice(events.waitIndex) ?? []),
          },
          false,
        );
        yield () => {
          events.waitIndex += result.waitObservationsUsed;
        };
        return result;
      }),
      'actions-window-allocation',
    );
    h.load(h.dp(0));
    h.dpWrite(DP_ACTION_MENU_WINDOW, ctx.a);
    h.load(1);
    h.dpWrite(2, ctx.a);
    h.dpWrite(DP_MENU_ROW, 0);
    for (const [offset, value] of [
      [DP_MENU_VISIBLE_ROWS, ACTION_VISIBLE_ROWS],
      [DP_LIST_TOKENS, ACTION_MENU_NAMES],
      [DP_LIST_TOKEN_BANK, WRAM_BANK],
      [DP_LIST_VALUES, ACTION_MENU_HOTKEYS],
    ]) {
      h.load(value);
      h.dpWrite(offset, ctx.a);
    }
    const menu = yield* call(
      0x809b7d,
      0x80a6a5,
      tableBody(0x80a6a5, () => menuComposeSequence(a, events, 0x80a6a5, false)),
      'actions-menu',
    );
    h.load(h.dp(0));
    h.compare(ctx.a, WORD_MASK);
    if (ctx.status & FLAG_ZERO) h.load(0);
    h.asl();
    index(ctx.a);
    h.load(h.read(h.abs(ACTION_MENU_FLAGS) + ctx.y));
    a.pushWord(ctx.a, 'actions-selected-flag-PHA');
    h.load(h.dp(DP_ACTION_MENU_WINDOW));
    h.dpWrite(0, ctx.a);
    const release = yield* call(
      0x809b94,
      0x80fa3e,
      () => releaseWindowJsrSequence(a, events),
      'actions-window-release',
    );
    h.load(a.pullWord('actions-selected-flag-PLA-fresh'));
    h.write(h.abs(ACTION_MENU_OVERRIDE), 0);
    return {
      ...finish(entry === 0x8099eb ? outerReturn : false),
      outcome: 'action_selected',
      optionCount,
      selectedFlag: ctx.a,
      allocation: allocation.outcome,
      menu: menu.outcome,
      release: release.outcome,
    };
  };
  if (entry === 0x8099eb) return yield* actions();
  h.write(h.abs(ACTION_MENU_OVERRIDE), 0);
  h.load(h.dp(0));
  const result = yield* call(0x809ba5, 0x8099eb, actions, 'native13-actions');
  h.dpWrite(0, ctx.a);
  return { ...result, ...finish(outerReturn), nativeResult: ctx.a };
}
// Table adapter of the main loop helper BF3B with its registered continuation.
export const chooseActionAdapter = (h, e) => runTaskNativeActions(h.a, e, 0x8099eb, false);
NATIVE_CALL_CONTINUATIONS.set(0x8099eb, {
  run: chooseActionAdapter,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, actionsSequence(h.a, events, 0x8099eb, false)),
});
export function validateTaskActionsOptions(options) {
  const {
    waitMode = null,
    waitObservations = null,
    inputMode = null,
    inputObservations = null,
  } = options ?? {};
  if (waitMode !== null && waitMode !== 'record-observations')
    return { handled: false, reason: 'task_wait_mode_required' };
  if (
    (inputMode !== null && inputMode !== 'record-observations') ||
    (inputObservations !== null && inputMode !== 'record-observations')
  )
    return { handled: false, reason: 'task_input_mode_required' };
  const records = (values, pcs) =>
    values === null ||
    (Array.isArray(values) &&
      Object.isFrozen(values) &&
      Array.from(values).every(
        (o) =>
          o &&
          Object.isFrozen(o) &&
          pcs.includes(o.pc) &&
          Number.isInteger(o.address) &&
          o.address >= 0 &&
          o.address <= LONG_MASK &&
          o.width === 2 &&
          Number.isInteger(o.value) &&
          o.value >= 0 &&
          o.value <= WORD_MASK,
      ));
  if (!records(waitObservations, [0x81acc3, 0x81acc9, 0x81acbd, 0x81acaf, 0x81b0a5]))
    return { handled: false, reason: 'task_wait_observations_required' };
  if (!records(inputObservations, [0x809e1a]))
    return { handled: false, reason: 'task_input_observations_required' };
  return null;
}
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits and inputs replay the register-level one.
function observedActions(a, options, entry, outerReturn, allowRemaining, lifted = null) {
  const {
    waitMode = null,
    waitObservations = null,
    inputMode = null,
    inputObservations = null,
  } = options ?? {};
  const events = withInterruptEvents(
    {
      mode: waitMode,
      values: waitObservations,
      waitIndex: 0,
      waitEvents: [],
      calls: [],
      inputMode,
      inputs: inputObservations,
      inputIndex: 0,
    },
    options,
  );
  const finish = (result) => {
    if (!allowRemaining && events.waitIndex !== (waitObservations?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
    if (!allowRemaining && events.inputIndex !== (inputObservations?.length ?? 0))
      taskStop('task_input_observation_unused', { observationIndex: events.inputIndex });
    return {
      ...result,
      calls: Object.freeze(events.calls),
      waitObservationsUsed: events.waitIndex,
      inputObservationsUsed: events.inputIndex,
    };
  };
  const sequence =
    lifted !== null && lagFree(events)
      ? lifted(dialogAccess(a), events)
      : actionsSequence(a, events, entry, outerReturn);
  return { sequence, finish };
}
export function runTaskActionsObserved(
  a,
  options,
  entry = 0x809ba0,
  outerReturn = true,
  allowRemaining = false,
  lifted = null,
) {
  const { sequence, finish } = observedActions(
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
export const createActionsObserved = (a, options, lifted = null) =>
  observedContinuation(a, observedActions(a, options, 0x809ba0, false, false, lifted));

export { entries as taskActionsEntries };
