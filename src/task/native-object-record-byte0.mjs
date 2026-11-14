import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { recordFirstByte } from '../game/object-fields.mjs';

// 80:CA2B (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return byte 0 of the record of the object
// (first argument).
export const getObjectRecordFirstByte = (a, outerReturn = true) => {
  setLeafResult(a, recordFirstByte(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
