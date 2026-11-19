import { finishLeaf } from '../system/native-leaf-support.mjs';
import { turnTowardsPlayer } from '../game/object-facing.mjs';

// 80:D1D2 (lifted in src/game/object-facing.mjs; register-level reference in
// proof/game-reference/object-facing.mjs): turn the object (first argument) towards the
// player object.
export const turnObjectToPlayer = (a, outerReturn = true) => {
  turnTowardsPlayer(a.mem);
  return finishLeaf(a, outerReturn);
};
