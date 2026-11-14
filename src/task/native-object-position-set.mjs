import {
  FIRST_ARGUMENT,
  FOURTH_ARGUMENT,
  SECOND_ARGUMENT,
  THIRD_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { setObjectPosition as setPosition } from '../game/object-fields.mjs';

// 80:D14A (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): set the X, Y and height of the object (first
// argument) to the second, third and fourth argument.
export const setObjectPosition = (a, outerReturn = true) => {
  const [object, x, y, height] = [
    FIRST_ARGUMENT,
    SECOND_ARGUMENT,
    THIRD_ARGUMENT,
    FOURTH_ARGUMENT,
  ].map((offset) => leafArgument(a, offset));
  setPosition(a.mem, object, x, y, height);
  return finishLeaf(a, outerReturn);
};
