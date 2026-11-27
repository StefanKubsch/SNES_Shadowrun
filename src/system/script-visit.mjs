// The nested head visit 80:C1CA uses the scheduler continuation when available;
// visits return ordinary values and use no CPU frame.
import { taskStop } from './task-stop.mjs';

export const SCRIPT_VISIT = 0x80c1ca;

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
