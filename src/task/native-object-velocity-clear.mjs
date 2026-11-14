import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { clearObjectVelocity as clearVelocity } from '../game/object-fields.mjs';

// 80:D13E (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): set the X, Y and Z velocity of the object
// (first argument) to zero.
export const clearObjectVelocity = (a, outerReturn = true) => {
  clearVelocity(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
