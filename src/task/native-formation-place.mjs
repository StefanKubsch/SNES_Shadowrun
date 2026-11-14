import { taskStop } from './plan.mjs';
import { finishLeaf } from './native-leaf-support.mjs';
import { placeInFormation } from '../game/formation-place.mjs';

// 80:BB2C (lifted in src/game/formation-place.mjs; register-level reference in
// proof/game-reference/formation-place.mjs): the object (first argument) takes its place
// in the formation.
export const placeObjectInFormation = (a, outerReturn = true) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  placeInFormation(a.mem, a);
  return finishLeaf(a, outerReturn);
};
