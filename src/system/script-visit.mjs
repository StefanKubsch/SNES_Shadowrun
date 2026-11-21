// The nested head visit 80:C1CA uses the scheduler continuation when available.
// Frozen callback callers keep their frame; live visits return ordinary values.
import { taskStop } from './task-stop.mjs';
import { dialogCallBody } from './native-call-continuation.mjs';

export const SCRIPT_VISIT = 0x80c1ca;

export function* scriptVisitCallSequence(h, events, pc, missingReason, onRound) {
  const visit = () => scriptVisitSequence(events, missingReason, onRound);
  if (events.valueRounds) return yield* visit();
  return yield* dialogCallBody(h, pc, SCRIPT_VISIT, visit);
}

export function* scriptVisitSequence(events, missingReason = 'task_f254_visit_open', onRound) {
  const round = events.nestedRound?.(SCRIPT_VISIT);
  if (round) {
    return yield { continuation: round };
  }
  let result;
  yield () => {
    if (!events.round) taskStop(missingReason);
    result = events.round(SCRIPT_VISIT);
    onRound?.(result);
  };
  return result;
}
