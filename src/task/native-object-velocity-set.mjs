import {
  FIRST_ARGUMENT,
  FOURTH_ARGUMENT,
  SECOND_ARGUMENT,
  THIRD_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { setObjectVelocity as setVelocity } from '../game/object-fields.mjs';

// 80:A92F (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): set the X, Y and Z velocity of the object
// (first argument) to the second, third and fourth argument.
export const setObjectVelocity = (a, outerReturn = true) => {
  const [object, x, y, z] = [FIRST_ARGUMENT, SECOND_ARGUMENT, THIRD_ARGUMENT, FOURTH_ARGUMENT].map(
    (offset) => leafArgument(a, offset),
  );
  setVelocity(a.mem, object, x, y, z);
  return finishLeaf(a, outerReturn);
};
