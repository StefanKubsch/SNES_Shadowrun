import { taskStop } from './plan.mjs';
import { finishLeaf } from './native-leaf-support.mjs';
import {
  haltObject as haltLiftedObject,
  resumeObject as resumeLiftedObject,
} from '../game/object-halt.mjs';

// 80:8E96 and 80:8EB8 (lifted in src/game/object-halt.mjs; register-level references in
// proof/game-reference/object-halt.mjs): halt or resume the object (first argument) and
// its task.
const run = (a, outerReturn, lifted) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  lifted(a.mem, a);
  return finishLeaf(a, outerReturn);
};
// 80:8E96: halt the object (first argument) and its task.
export const haltObject = (a, outerReturn = true) => run(a, outerReturn, haltLiftedObject);
// 80:8EB8: resume the object (first argument) and its task.
export const resumeObject = (a, outerReturn = true) => run(a, outerReturn, resumeLiftedObject);
