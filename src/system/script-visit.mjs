// The nested head visit 80:C1CA uses the scheduler continuation when available.
// Frozen callback callers keep their frame; live visits return ordinary values.
import { taskStop } from './task-stop.mjs';
import { recordedCallBody } from './register-compat.mjs';

export const SCRIPT_VISIT = 0x80c1ca;

export function* scriptVisitCallSequence(h, events, pc, missingReason, onRound) {
  const visit = () => scriptVisitSequence(events, missingReason, onRound);
  if (events.valueRounds) return yield* visit();
  return yield* recordedCallBody(h, pc, SCRIPT_VISIT, visit);
}

export function* scriptVisitSequence(events, missingReason = 'task_f254_visit_open', onRound) {
  const round = events.nestedHeadVisit
    ? events.nestedHeadVisit()
    : events.nestedRound?.(SCRIPT_VISIT);
  if (round) {
    return yield { continuation: round };
  }
  let result;
  yield () => {
    if (!events.headVisit && !events.round) taskStop(missingReason);
    result = events.headVisit ? events.headVisit() : events.round(SCRIPT_VISIT);
    onRound?.(result);
  };
  return result;
}
