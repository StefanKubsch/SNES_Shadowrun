import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { recordFlags } from '../game/object-fields.mjs';

// 80:CA3A (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the flag byte of the record of the object
// (first argument).
export const getObjectRecordFlags = (a, outerReturn = true) => {
  setLeafResult(a, recordFlags(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
