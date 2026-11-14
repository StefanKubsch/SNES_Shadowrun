import { taskStop } from './plan.mjs';
import { finishLeaf } from './native-leaf-support.mjs';
import { selectObjectAnimation } from '../game/object-turn.mjs';

// 80:A985 (lifted in src/game/object-turn.mjs; register-level reference in
// proof/game-reference/object-turn.mjs): select animation (second argument) for the
// object (first argument) unless that animation is already selected.
export const setObjectAnimation = (a, outerReturn = true) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  selectObjectAnimation(a.mem, a.mem.wram);
  return finishLeaf(a, outerReturn);
};
