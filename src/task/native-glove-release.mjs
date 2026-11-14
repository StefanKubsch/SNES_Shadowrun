import { withInterruptEvents } from './observed-native-events.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { putGloveAwayAdapter } from './native-dialog-portrait.mjs';
import { runDrawWindowList } from '../game/window-list.mjs';
import {
  observedContinuation,
  drainNativeSequence,
  dialogCallSequence,
} from './native-call-continuation.mjs';
import { validateGloveTaskOptions } from './native-glove-target.mjs';
import { BANK_WRAP, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';
import { DIALOG_WINDOW } from './wram.mjs';
// 80:CD9D: put the glove away and redraw the window list: STZ $1D61, JSR BCB2 (glove off, name window released over BE5B/FA3E), JSL 81:AD92 (window
// list), RTS. Both routines have their own proofs; their waits are observations as in 9BC6.
export function releaseGlove(a, events, outerReturn = true, routines = null) {
  return drainNativeSequence(cd9dSequence(a, events, outerReturn, routines));
}
function* cd9dSequence(a, events, outerReturn, routines = null) {
  if (
    a.ctx.d !== 0 ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_cd9d_entry_required');
  const h = dialogAccess(a),
    { ctx } = h,
    calls =
      routines === null
        ? RELEASE_GLOVE_ROUTINES
        : new Map([
            [0x80bcb2, () => routines.bcb2(h)],
            [0x81ad92, () => routines.list(h)],
          ]);
  yield () => h.write(h.abs(DIALOG_WINDOW), 0);
  yield* dialogCallSequence(h, events, calls, 0x80cda0, 0x80bcb2);
  yield* dialogCallSequence(h, events, calls, 0x80cda3, 0x81ad92, true);
  let result;
  yield () => {
    const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'CD9D-RTS', outerReturn);
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = {
      rawReturnWord,
      returnTarget: CODE_BANK_BASE | ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
      scope: 'manual-source-specific-native-cd9d',
    };
  };
  return result;
}
const RELEASE_GLOVE_ROUTINES = new Map([
  [0x80bcb2, putGloveAwayAdapter],
  [0x81ad92, runDrawWindowList],
]);
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits replay the register-level native.
function observeReleaseGlove(a, options, outerReturn, lifted = null) {
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
  const sequence =
    lifted !== null && lagFree(events)
      ? lifted(dialogAccess(a), events)
      : cd9dSequence(a, events, outerReturn);
  return { sequence, finish };
}
export function releaseGloveObserved(a, options, outerReturn = true, lifted = null) {
  const { sequence, finish } = observeReleaseGlove(a, options, outerReturn, lifted);
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createReleaseGloveObserved = (a, options, lifted = null) =>
  observedContinuation(a, observeReleaseGlove(a, options, false, lifted));
