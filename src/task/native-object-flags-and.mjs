import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { keepObjectFlagBits as keepBits } from '../game/object-fields.mjs';

// 80:CA20 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): keep only the bits of the second argument in
// the flag word of the object (first argument).
export const keepObjectFlagBits = (a, outerReturn = true) => {
  keepBits(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
