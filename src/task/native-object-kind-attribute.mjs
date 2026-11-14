import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { objectKindValue } from '../game/kind-values.mjs';

// 80:C9F1 (lifted in src/game/kind-values.mjs; register-level reference in
// proof/game-reference/kind-values.mjs): return the kind value of the object
// (first argument).
export const getObjectKindValue = (a, outerReturn = true) => {
  setLeafResult(a, objectKindValue(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
