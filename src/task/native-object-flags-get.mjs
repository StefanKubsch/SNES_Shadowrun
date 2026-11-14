import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { objectFlags } from '../game/object-fields.mjs';

// 80:CA05 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the flag word of the object (first
// argument).
export const getObjectFlags = (a, outerReturn = true) => {
  setLeafResult(a, objectFlags(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
