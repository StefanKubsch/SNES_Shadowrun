import { withInterruptEvents } from './observed-native-events.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT } from './native-leaf-support.mjs';
import { runDrawWindowList } from '../game/window-list.mjs';
import { raiseStateCount } from '../game/runner-state.mjs';
import {
  observedContinuation,
  drainNativeSequence,
  dialogCallSequence,
} from './native-call-continuation.mjs';
import { validateGloveTaskOptions } from './native-glove-target.mjs';
import { DP_RESOURCE_RECORD, DP_RESOURCE_RECORD_BANK, DP_RESOURCE_MAX } from './wram.mjs';
import { BYTE_BITS, BYTE_MASK, BANK_WRAP, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';
// 80:CECB (lifted body in src/game/runner-state.mjs; register-level reference in
// proof/game-reference/runner-state.mjs; first argument the object, second the amount, no result): raise a member's state
// count. The object number of the object is searched in the group numbers from the last
// index down by 2; without a match the player object is searched instead (without a match
// again the original loops forever: boundary). The runner entry of the number (X from 18
// down by 2, without a match FFFE) gives the member record; its byte 5 is the maximum DP04.
// An object record gets its state count BYTE + the amount, at most DP04. Then JSL 81:AD92
// redraws the window list, RTS.
const dpWord = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setDpWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// The lifted body (src/game/runner-state.mjs) with the direct page values the original
// leaves: the member record pointer at the maximum and the maximum.
export function raiseStateCountBody(h) {
  const { mem } = h.a,
    { wram } = mem,
    { record, max } = raiseStateCount(
      mem,
      dpWord(wram, FIRST_ARGUMENT),
      dpWord(wram, SECOND_ARGUMENT),
    );
  setDpWord(wram, DP_RESOURCE_RECORD, record & WORD_MASK);
  wram[DP_RESOURCE_RECORD_BANK] = record >>> WORD_BITS;
  setDpWord(wram, DP_RESOURCE_MAX, max);
}
export function raiseMemberStateCount(a, events, outerReturn = true, routines = null) {
  return drainNativeSequence(cecbSequence(a, events, outerReturn, routines));
}
export function* cecbSequence(a, events, outerReturn, routines = null, body = raiseStateCountBody) {
  if (
    a.ctx.d !== 0 ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_cecb_entry_required');
  const h = dialogAccess(a),
    { ctx } = h,
    calls = routines === null ? LIST_ROUTINES : new Map([[0x81ad92, () => routines.list(h)]]);
  yield () => body(h);
  yield* dialogCallSequence(h, events, calls, 0x80cf29, 0x81ad92, true);
  let result;
  yield () => {
    const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'CECB-RTS', outerReturn);
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = {
      rawReturnWord,
      returnTarget: CODE_BANK_BASE | ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
      scope: 'manual-source-specific-native-cecb',
    };
  };
  return result;
}
const LIST_ROUTINES = new Map([[0x81ad92, runDrawWindowList]]);
function observeRaiseMemberStateCount(a, options, outerReturn, body = raiseStateCountBody) {
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
  return { sequence: cecbSequence(a, events, outerReturn, null, body), finish };
}
// body: the register-level reference body for the proofs.
export function raiseMemberStateCountObserved(a, options, outerReturn = true, body = undefined) {
  const { sequence, finish } = observeRaiseMemberStateCount(a, options, outerReturn, body);
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createRaiseMemberStateCountObserved = (a, options) =>
  observedContinuation(a, observeRaiseMemberStateCount(a, options, false));
