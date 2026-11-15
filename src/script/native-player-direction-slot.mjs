import { taskStop } from '../system/task-stop.mjs';
import { finishLeaf } from '../system/native-leaf-support.mjs';
import { turnTowardsPlayer } from '../game/object-facing.mjs';

// 80:D1D2 (lifted in src/game/object-facing.mjs; register-level reference in
// proof/game-reference/object-facing.mjs): turn the object (first argument) towards the
// player object.
export const turnObjectToPlayer = (a, outerReturn = true) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  turnTowardsPlayer(a.mem, a);
  return finishLeaf(a, outerReturn);
};
