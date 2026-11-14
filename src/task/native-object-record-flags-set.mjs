import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { setRecordFlags } from '../game/object-fields.mjs';

// 80:CAA2 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): set the flag byte of the record of
// the object (first argument) to the low byte of the second argument; no record, no change.
export const setObjectRecordFlags = (a, outerReturn = true) => {
  setRecordFlags(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
