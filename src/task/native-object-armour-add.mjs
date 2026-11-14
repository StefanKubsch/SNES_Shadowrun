import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { raiseObjectArmour } from '../game/object-fields.mjs';

// 80:8AFA (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): the armour of the object (first argument) plus the
// second argument, a wrapping 16-bit sum without a limit.
export const addObjectArmour = (a, outerReturn = true) => {
  raiseObjectArmour(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
