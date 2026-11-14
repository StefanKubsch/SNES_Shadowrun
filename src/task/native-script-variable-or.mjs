import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { setVariableBits } from '../game/script-variables.mjs';

// 80:CC19 (lifted in src/game/script-variables.mjs; register-level reference in
// proof/game-reference/script-variables.mjs): set the bits of the second argument in the script
// variable at the byte offset in the first argument.
export const setScriptVariableBits = (a, outerReturn = true) => {
  setVariableBits(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
