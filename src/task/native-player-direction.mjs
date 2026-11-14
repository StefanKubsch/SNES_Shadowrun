import { taskStop } from './plan.mjs';
import { finishLeaf } from './native-leaf-support.mjs';
import { getDirectionToPlayer as directionToPlayer } from '../game/object-facing.mjs';

// 80:D1DD (lifted in src/game/object-facing.mjs; register-level reference in
// proof/game-reference/object-facing.mjs): return the direction from the object in the
// first argument towards the player object.
export const getDirectionToPlayer = (a, outerReturn = true) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  directionToPlayer(a.mem, a);
  return finishLeaf(a, outerReturn);
};
