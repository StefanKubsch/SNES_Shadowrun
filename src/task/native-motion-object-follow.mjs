import { leaf } from './native-leaf-support.mjs';
import { startMotionToObject } from './native-motion-object-move.mjs';
import { MOTION_STRAIGHT } from './wram.mjs';

// 80:C6F3: move the object (first argument) straight towards the object in the second
// argument (body of 80:C6F8 with mode 0).
export const moveObjectStraightToObject = (a, outerReturn = true) =>
  leaf(a, (h) => startMotionToObject(h, MOTION_STRAIGHT), outerReturn);
