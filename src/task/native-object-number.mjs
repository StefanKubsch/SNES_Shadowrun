import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { objectNumber } from '../game/object-fields.mjs';

// 80:D1CA (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the object number of the object slot
// (first argument).
export const getObjectNumber = (a, outerReturn = true) => {
  setLeafResult(a, objectNumber(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
