import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { recordCount } from '../game/object-fields.mjs';

// 80:CA49 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the count byte of the record of the object
// (first argument).
export const getObjectRecordCount = (a, outerReturn = true) => {
  setLeafResult(a, recordCount(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
