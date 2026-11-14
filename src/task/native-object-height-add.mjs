import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { raiseObjectHeight } from '../game/object-fields.mjs';

// 80:A977 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): raise the height of the object (first
// argument) by four times the second argument.
export const addObjectHeight = (a, outerReturn = true) => {
  raiseObjectHeight(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
