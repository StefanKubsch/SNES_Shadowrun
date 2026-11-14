import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
  setLeafWord,
} from './native-leaf-support.mjs';
import { moveToPlayer } from '../game/motion-targets.mjs';

// 80:C716 (lifted in src/game/motion-targets.mjs; register-level reference in
// proof/game-reference/motion-targets.mjs): move the object (first
// argument) straight towards the player object; the player object becomes the second
// argument.
export const moveObjectStraightToPlayer = (a, outerReturn = true) => {
  setLeafWord(a, SECOND_ARGUMENT, moveToPlayer(a.mem, leafArgument(a, FIRST_ARGUMENT), true));
  return finishLeaf(a, outerReturn);
};
