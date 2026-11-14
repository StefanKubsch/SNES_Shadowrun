import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { keepRecordFlagBits } from '../game/object-fields.mjs';

// 80:CACA (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): keep only the bits of the second
// argument's low byte in the flag byte of the record of the object (first argument).
export const keepObjectRecordFlagBits = (a, outerReturn = true) => {
  keepRecordFlagBits(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
