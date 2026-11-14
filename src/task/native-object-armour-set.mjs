import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { storeObjectArmour } from '../game/object-fields.mjs';

// 80:8AF1 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): set the armour of the object (first argument) to
// the second argument.
export const setObjectArmour = (a, outerReturn = true) => {
  storeObjectArmour(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
