import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from '../system/native-leaf-support.mjs';
import { moveToObject } from '../game/motion-targets.mjs';

// 80:C6F3 (lifted in src/game/motion-targets.mjs; register-level reference in
// proof/game-reference/motion-targets.mjs): move the object (first
// argument) straight towards the object in the second argument.
export const moveObjectStraightToObject = (a) => {
  moveToObject(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT), true);
  return finishLeaf(a);
};
