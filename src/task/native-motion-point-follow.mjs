import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  THIRD_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { moveToPoint } from '../game/motion-targets.mjs';

// 80:C79C (lifted in src/game/motion-targets.mjs; register-level reference in
// proof/game-reference/motion-targets.mjs): move the object (first
// argument) straight towards the point in the second and third argument.
export const moveObjectStraightToPoint = (a, outerReturn = true) => {
  const [object, x, y] = [FIRST_ARGUMENT, SECOND_ARGUMENT, THIRD_ARGUMENT].map((offset) =>
    leafArgument(a, offset),
  );
  moveToPoint(a.mem, object, x, y, true);
  return finishLeaf(a, outerReturn);
};
