import { withInterruptEvents } from './observed-native-events.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { runDrawWindowList } from '../game/window-list.mjs';
import { restoreRunners } from '../game/runner-state.mjs';
import {
  observedContinuation,
  drainNativeSequence,
  dialogCallSequence,
} from './native-call-continuation.mjs';
import { validateGloveTaskOptions } from './native-glove-target.mjs';
import { DP_RESOURCE_RECORD, DP_RESOURCE_RECORD_BANK, DP_REFILL_DOUBLE_MAGIC } from './wram.mjs';
import { BYTE_BITS, BYTE_MASK, BANK_WRAP, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_MEMORY_8BIT, FLAG_INDEX_8BIT } from '../constants/cpu-flags.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';
// 80:D079 (lifted body in src/game/runner-state.mjs; register-level reference in
// proof/game-reference/runner-state.mjs; no argument, no result): restore every runner. For the runner entries X = 18
// down to 0 (PHX, JSR D08A, PLX) the magic points and the state count are refilled, then
// JSL 81:AD92 draws the window list. D08A: pointer [6B] = member record + 1 (Magic); the
// runner's object number gives its object record (0: nothing); the magic points 7E3C96+X/2
// get ten times the BYTE [6B] (BYTE arithmetic), the record's state count BYTE the BYTE
// [6B+4] (record byte 5, the state count maximum).
const setDpWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// The lifted body (src/game/runner-state.mjs) with the direct page values the original
// leaves: the first row's record pointer and the last refilled magic attribute doubled.
export function restoreRunnersBody(h) {
  const { mem } = h.a,
    { wram } = mem,
    { record, doubleMagic } = restoreRunners(mem);
  setDpWord(wram, DP_RESOURCE_RECORD, record & WORD_MASK);
  wram[DP_RESOURCE_RECORD_BANK] = record >>> WORD_BITS;
  if (doubleMagic !== undefined) wram[DP_REFILL_DOUBLE_MAGIC] = doubleMagic;
}
export function restoreAllRunners(a, events, outerReturn = true, routines = null) {
  return drainNativeSequence(d079Sequence(a, events, outerReturn, routines));
}
export function* d079Sequence(a, events, outerReturn, routines = null, body = restoreRunnersBody) {
  if (
    a.ctx.d !== 0 ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_d079_entry_required');
  const h = dialogAccess(a),
    { ctx } = h,
    calls = routines === null ? LIST_ROUTINES : new Map([[0x81ad92, () => routines.list(h)]]);
  yield () => body(h);
  yield* dialogCallSequence(h, events, calls, 0x80d085, 0x81ad92, true);
  let result;
  yield () => {
    const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'D079-RTS', outerReturn);
    ctx.s = (ctx.s + 2) & WORD_MASK;
    ctx.pc = (rawReturnWord + 1) & WORD_MASK;
    result = {
      rawReturnWord,
      returnTarget: CODE_BANK_BASE | ctx.pc,
      returnTargetExecuted: false,
      dynamicDispatchExecuted: false,
      frontier: 'observed-outer-RTS-target',
      scope: 'manual-source-specific-native-d079',
    };
  };
  return result;
}
const LIST_ROUTINES = new Map([[0x81ad92, runDrawWindowList]]);
function observeRestoreAllRunners(a, options, outerReturn, body = restoreRunnersBody) {
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
  return { sequence: d079Sequence(a, events, outerReturn, null, body), finish };
}
// body: the register-level reference body for the proofs.
export function restoreAllRunnersObserved(a, options, outerReturn = true, body = undefined) {
  const { sequence, finish } = observeRestoreAllRunners(a, options, outerReturn, body);
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createRestoreAllRunnersObserved = (a, options) =>
  observedContinuation(a, observeRestoreAllRunners(a, options, false));
