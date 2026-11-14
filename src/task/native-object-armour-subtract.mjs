import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { lowerObjectArmour } from '../game/object-fields.mjs';

// 80:8B08 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): the armour of the object (first argument) minus
// the second argument, a wrapping 16-bit difference without a lower limit.
export const subtractObjectArmour = (a, outerReturn = true) => {
  lowerObjectArmour(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
