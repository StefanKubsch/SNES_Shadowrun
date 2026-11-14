import { taskStop } from './plan.mjs';
import { finishLeaf } from './native-leaf-support.mjs';
import { enterMatrix as enterLiftedMatrix } from '../game/matrix-enter.mjs';

// 80:E30F (lifted in src/game/matrix-enter.mjs; register-level reference in
// proof/game-reference/matrix-enter.mjs): enter the Matrix. Arguments: the matrix
// system, the room to return to, the extra nodes, the message list and the decker's
// object number.
export const enterMatrix = (a, outerReturn = true) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  enterLiftedMatrix(a.mem, a);
  return finishLeaf(a, outerReturn);
};
