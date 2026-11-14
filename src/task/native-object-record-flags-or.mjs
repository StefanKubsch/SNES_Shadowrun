import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { setRecordFlagBits } from '../game/object-fields.mjs';

// 80:CAB4 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): set the bits of the second argument's
// low byte in the flag byte of the record of the object (first argument).
export const setObjectRecordFlagBits = (a, outerReturn = true) => {
  setRecordFlagBits(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
