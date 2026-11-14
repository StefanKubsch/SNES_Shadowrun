import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { recordProperty } from '../game/object-fields.mjs';

// 80:CA58 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the property word of the record of the object
// (first argument).
export const getObjectRecordProperty = (a, outerReturn = true) => {
  setLeafResult(a, recordProperty(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
