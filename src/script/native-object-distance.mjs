import {
  FIRST_ARGUMENT,
  finishLeaf,
  leafArgument,
  setLeafResult,
} from '../system/native-leaf-support.mjs';
import { distanceToPlayer } from '../game/object-distance.mjs';

// 80:C68D (lifted in src/game/object-distance.mjs; register-level reference in
// proof/game-reference/script-measures.mjs): distance of the object (first argument) to
// the player object.
export const getDistanceToPlayer = (a, outerReturn = true) => {
  setLeafResult(a, distanceToPlayer(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
