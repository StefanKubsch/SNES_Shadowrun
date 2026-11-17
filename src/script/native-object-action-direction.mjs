// Script native 80:D15C, lifted (src/game/member-facing.mjs); the register-level
// reference is in proof/script/native-object-turn.mjs.
import { finishLeaf } from '../system/native-leaf-support.mjs';
import { setActionAndDirection } from '../game/member-facing.mjs';
import { taskStop } from '../system/task-stop.mjs';

// 80:D15C (lifted in src/game/member-facing.mjs; register-level reference in
// proof/script/native-object-turn.mjs): set the
// object's action selection (A985), then its direction (AAAF).
export const setObjectActionAndDirection = (a, outerReturn = true) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  setActionAndDirection(a.mem, a);
  return finishLeaf(a, outerReturn);
};
