import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { moveToObject } from '../game/motion-targets.mjs';

// 80:C6F8 (lifted in src/game/motion-targets.mjs; register-level reference in
// proof/game-reference/motion-targets.mjs): move the object (first
// argument) axis by axis towards the object in the second argument.
export const moveObjectToObject = (a, outerReturn = true) => {
  moveToObject(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
