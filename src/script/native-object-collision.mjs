import { taskStop } from '../system/task-stop.mjs';
import { finishLeaf } from '../system/native-leaf-support.mjs';
import { testActionBoxCollision } from '../game/action-box-collision.mjs';

// 80:8371 (lifted in src/game/action-box-collision.mjs; register-level reference in
// proof/game-reference/action-box-collision.mjs): the collision test of the object (first
// argument) with the action box of its kind in the direction of the second argument;
// the result FFFF when a box above its bottom was found, else 0.
export const testObjectCollision = (a, outerReturn = true) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  testActionBoxCollision(a.mem, a);
  return finishLeaf(a, outerReturn);
};
