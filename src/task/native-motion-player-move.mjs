import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
  setLeafWord,
} from './native-leaf-support.mjs';
import { moveToPlayer } from '../game/motion-targets.mjs';

// 80:C71D (lifted in src/game/motion-targets.mjs; register-level reference in
// proof/game-reference/motion-targets.mjs): move the object (first
// argument) axis by axis towards the player object; the player object becomes the
// second argument.
export const moveObjectToPlayer = (a, outerReturn = true) => {
  setLeafWord(a, SECOND_ARGUMENT, moveToPlayer(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
