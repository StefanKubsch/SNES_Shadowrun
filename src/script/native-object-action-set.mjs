import { taskStop } from '../system/task-stop.mjs';
import { finishLeaf } from '../system/native-leaf-support.mjs';
import { turnObject } from '../game/object-turn.mjs';

// 80:AAAF (lifted in src/game/object-turn.mjs; register-level reference in
// proof/game-reference/object-turn.mjs): turn the object (first argument) to the
// direction in the second argument and move its frame to that direction, or restart its
// last animation when the frame count does not allow a direct switch.
export const setObjectDirection = (a, outerReturn = true) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  turnObject(a.mem, a.mem.wram, a);
  return finishLeaf(a, outerReturn);
};
