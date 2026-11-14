import { finishLeaf, setLeafResult } from './native-leaf-support.mjs';
import { hasFightTarget as hasTarget } from '../game/fight-list.mjs';

// 80:866F (lifted in src/game/fight-list.mjs; register-level reference in
// proof/game-reference/fight-list-queries.mjs): return TRUE (FFFF) when an object of the
// fight list is drawn on screen and may be targeted, else FALSE (0).
export const hasFightTarget = (a, outerReturn = true) => {
  setLeafResult(a, hasTarget(a.mem));
  return finishLeaf(a, outerReturn);
};
