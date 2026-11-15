import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  THIRD_ARGUMENT,
  finishLeaf,
  leafArgument,
} from '../system/native-leaf-support.mjs';
import { moveToPoint } from '../game/motion-targets.mjs';

// 80:C7A1 (lifted in src/game/motion-targets.mjs; register-level reference in
// proof/game-reference/motion-targets.mjs): move the object (first
// argument) axis by axis towards the point in the second and third argument.
export const moveObjectToPoint = (a, outerReturn = true) => {
  const [object, x, y] = [FIRST_ARGUMENT, SECOND_ARGUMENT, THIRD_ARGUMENT].map((offset) =>
    leafArgument(a, offset),
  );
  moveToPoint(a.mem, object, x, y);
  return finishLeaf(a, outerReturn);
};
