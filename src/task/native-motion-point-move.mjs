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

const THIRD_ARGUMENT = 4;

// Shared body of 80:C79C and C7A1: the object (first argument) gets a motion towards
// the point (second and third argument, times four as two ASLs): the mode, then X and
// Y, then the motion started (long indexed, bank carry). The flags come from the last
// LDA #1.
export function startMotionToPoint(h, motionMode) {
  const mode = h.load(motionMode),
    object = h.index('x', h.dp(FIRST_ARGUMENT));
  h.longWrite(WRAM + MOTION_MODE + object, mode);
  for (const [argument, target] of [
    [SECOND_ARGUMENT, MOTION_X],
    [THIRD_ARGUMENT, MOTION_Y],
  ]) {
    h.load(h.dp(argument));
    h.asl();
    h.asl();
    h.longWrite(WRAM + target + object, h.ctx.a);
  }
  h.longWrite(WRAM + MOTION_ACTIVE + object, h.load(MOTION_START));
}

// 80:C7A1: move the object (first argument) axis by axis towards the point in the
// second and third argument.
export const moveObjectToPoint = (a, outerReturn = true) =>
  leaf(a, (h) => startMotionToPoint(h, MOTION_BY_AXES), outerReturn);
