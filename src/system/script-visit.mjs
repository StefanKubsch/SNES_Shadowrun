// The nested head visit 80:C1CA uses the scheduler continuation when available.
// The caller owns its original JSR frame; the round returns through that frame.
import { taskStop } from './task-stop.mjs';

export const SCRIPT_VISIT = 0x80c1ca;

export function* scriptVisitSequence(events) {
  const round = events.nestedRound?.(SCRIPT_VISIT);
  if (round) {
    return yield { continuation: round };
  }
  let result;
  yield () => {
    if (!events.round) taskStop('task_f254_visit_open');
    result = events.round(SCRIPT_VISIT);
  };
  return result;
}
