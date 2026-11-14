import { leaf } from './native-leaf-support.mjs';
import { startMotionToPoint } from './native-motion-point-move.mjs';
import { MOTION_STRAIGHT } from './wram.mjs';

// 80:C79C: move the object (first argument) straight towards the point in the second
// and third argument (body of 80:C7A1 with mode 0).
export const moveObjectStraightToPoint = (a, outerReturn = true) =>
  leaf(a, (h) => startMotionToPoint(h, MOTION_STRAIGHT), outerReturn);
