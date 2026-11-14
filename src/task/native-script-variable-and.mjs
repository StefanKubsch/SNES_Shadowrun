import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { keepVariableBits } from '../game/script-variables.mjs';

// 80:CC26 (lifted in src/game/script-variables.mjs; register-level reference in
// proof/game-reference/script-variables.mjs): keep only the bits of the second argument in the
// script variable at the byte offset in the first argument.
export const keepScriptVariableBits = (a, outerReturn = true) => {
  keepVariableBits(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
