import { finishLeaf } from '../system/native-leaf-support.mjs';
import { turnTowardsObject } from '../game/object-facing.mjs';

// 80:CF93 (lifted in src/game/object-facing.mjs; register-level reference in
// proof/game-reference/object-facing.mjs): the object (first argument) turns towards the
// object in the second argument (low byte FF: none).
export const turnObjectToObject = (a, outerReturn = true) => {
  turnTowardsObject(a.mem);
  return finishLeaf(a, outerReturn);
};
