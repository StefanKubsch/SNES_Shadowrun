import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import {
  MOTION_ACTIVE,
  MOTION_BY_AXES,
  MOTION_MODE,
  MOTION_START,
  MOTION_X,
  MOTION_Y,
  WRAM,
} from './wram.mjs';

// Shared body of 80:C6F3, C6F8, C716 and C71D: the object (first argument) gets a motion
// towards the object in the second argument: the mode in A (LDA #mode before LDX), X 0,
// the target object in the Y field and the motion started (long indexed, bank carry).
// The flags come from the last LDA #1.
export function startMotionToObject(h, motionMode = MOTION_BY_AXES) {
  const mode = h.load(motionMode),
    object = h.index('x', h.dp(FIRST_ARGUMENT));
  h.longWrite(WRAM + MOTION_MODE + object, mode);
  h.longWrite(WRAM + MOTION_X + object, h.load(0));
  h.longWrite(WRAM + MOTION_Y + object, h.load(h.dp(SECOND_ARGUMENT)));
  h.longWrite(WRAM + MOTION_ACTIVE + object, h.load(MOTION_START));
}

// 80:C6F8: move the object (first argument) axis by axis towards the object in the
// second argument.
export const moveObjectToObject = (a, outerReturn = true) =>
  leaf(a, (h) => startMotionToObject(h), outerReturn);
