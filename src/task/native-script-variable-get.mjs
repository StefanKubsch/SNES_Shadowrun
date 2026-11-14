import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { scriptVariable } from '../game/script-variables.mjs';

// 80:CC07 (lifted in src/game/script-variables.mjs; register-level reference in
// proof/game-reference/script-variables.mjs): return the script variable at the byte offset in
// the first argument.
export const getScriptVariable = (a, outerReturn = true) => {
  setLeafResult(a, scriptVariable(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
