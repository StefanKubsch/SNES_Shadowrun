import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { storeScriptVariable } from '../game/script-variables.mjs';

// 80:CC10 (lifted in src/game/script-variables.mjs; register-level reference in
// proof/game-reference/script-variables.mjs): set the script variable at the byte offset in the
// first argument to the second argument.
export const setScriptVariable = (a, outerReturn = true) => {
  storeScriptVariable(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
