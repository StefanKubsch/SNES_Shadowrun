import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { setObjectFlags as setFlags } from '../game/object-fields.mjs';

// 80:CA0D (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): replace the flag word of the object (first
// argument) with the second argument.
export const setObjectFlags = (a, outerReturn = true) => {
  setFlags(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
