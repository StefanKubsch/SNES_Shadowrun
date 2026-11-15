// Shared callee frame for the lifted object search. Register-level glove helpers
// and their tables live in proof/replay/native-glove-target-support.mjs.
import { taskStop } from './plan.mjs';
import { dialogCallSequence } from './native-call-continuation.mjs';

export function routineCall(routines, events, h, pc, target, long = false) {
  if (!routines.get(target)) taskStop('task_9bc6_routine_open', { pc, target });
  return dialogCallSequence(h, events, routines, pc, target, long);
}
