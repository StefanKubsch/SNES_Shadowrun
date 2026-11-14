import { DIALOG_WINDOW } from './wram.mjs';
import { withInterruptEvents } from './observed-native-events.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, leafAccess, finishLeaf } from './native-leaf-support.mjs';
import { drawWindowListJslSequence } from '../game/window-list.mjs';
import { observedContinuation, drainNativeSequence } from './native-call-continuation.mjs';
import { af1fRegisters } from './native-bar-tiles.mjs';
import { LONG_MASK, WORD_MASK, BANK_WRAP } from '../constants/bits.mjs';

const TEXT_CODE_BANK = 0x81;
const AD92_ENTRY_OFFSET = 0xad92;
const CDA8_RENDER_RETURN_WORD = 0xcdb0;
const CDA8_RENDER_CONTINUATION = 0xcdb1;

export { af1fRegisters as cda8Registers };
// 80:CDA8: redraw the window list of the dialog window: LDA 1D61 (actualDBR), STA DP00
// (first argument of AD92), real 3-byte JSL 81:AD92 (window list render with A9B2/ACCF/
// ACB5-ACAF wait), RTS. AD92 is the proved composition; waits are observations. With the
// lag-free frame model the window list runs lifted (src/game/window-list.mjs).
export function redrawWindowList(a, events, outerReturn = true) {
  return drainNativeSequence(cda8Sequence(a, events, outerReturn));
}
function* cda8Sequence(a, events, outerReturn) {
  const h = leafAccess(a);
  let bank, result;
  yield () => {
    h.load(h.longRead(h.abs(DIALOG_WINDOW)));
    a.writeWord(FIRST_ARGUMENT, h.ctx.a, BANK_WRAP, 'CDA8-DP00');
    bank = h.ctx.programBank;
    a.write(h.ctx.s, bank, 'CDA8-JSL-bank');
    h.ctx.s = (h.ctx.s - 1) & WORD_MASK;
    a.pushWord(CDA8_RENDER_RETURN_WORD, 'CDA8-JSL-WORD');
    h.ctx.programBank = TEXT_CODE_BANK;
    h.ctx.pc = AD92_ENTRY_OFFSET;
  };
  const render = yield* drawWindowListJslSequence(a, events);
  yield () => {
    if (
      render.rawReturnWord !== CDA8_RENDER_RETURN_WORD ||
      h.ctx.programBank !== bank ||
      h.ctx.pc !== CDA8_RENDER_CONTINUATION
    )
      taskStop('task_native_helper_return_required', {
        at: 0x80cdad,
        raw: render.rawReturnWord,
        bank: h.ctx.programBank,
        pc: h.ctx.pc,
      });
    result = {
      ...finishLeaf(a, outerReturn),
      outcome: 'window_list_rendered',
      render,
    };
  };
  return result;
}
export function validateWindowListRedrawOptions(options) {
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
          o.pc === 0x81acaf &&
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
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits replay the register-level native.
function observeRedrawWindowList(
  a,
  options,
  outerReturn,
  allowRemainingWaitObservations,
  lifted = null,
) {
  const invalid = validateWindowListRedrawOptions(options);
  if (invalid) taskStop(invalid.reason);
  const events = withInterruptEvents(
    {
      mode: options?.waitMode ?? null,
      values: options?.waitObservations ?? null,
      waitIndex: 0,
      waitEvents: [],
    },
    options,
  );
  const finish = (result) => {
    if (!allowRemainingWaitObservations && events.waitIndex !== (events.values?.length ?? 0))
      taskStop('task_wait_observation_unused', {
        observationIndex: events.waitIndex,
      });
    return {
      ...result,
      waitObservationsUsed: events.waitIndex,
      waitEvents: Object.freeze(events.waitEvents),
    };
  };
  const sequence =
    lifted !== null && lagFree(events)
      ? lifted(dialogAccess(a), events)
      : cda8Sequence(a, events, outerReturn);
  return { sequence, finish };
}
export function redrawWindowListObserved(
  a,
  options,
  outerReturn = true,
  allowRemainingWaitObservations = false,
  lifted = null,
) {
  const { sequence, finish } = observeRedrawWindowList(
    a,
    options,
    outerReturn,
    allowRemainingWaitObservations,
    lifted,
  );
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export function createRedrawWindowListObserved(a, options, lifted = null) {
  return observedContinuation(a, observeRedrawWindowList(a, options, false, false, lifted));
}
