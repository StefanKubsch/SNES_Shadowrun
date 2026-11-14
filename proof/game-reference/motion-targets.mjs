// Register-level references of the scripts' motion target natives (moved from
// src/task/native-motion-*.mjs; lifted in src/game/motion-targets.mjs). The proof plans,
// the Native58 dispatch of proof/task/native-dispatch.mjs and the instruction tests of
// tools/task-native-m1d.test.mjs run these; the game runs the lifted natives.
import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  THIRD_ARGUMENT,
  leaf,
} from '../../src/task/native-leaf-support.mjs';
import {
  MOTION_ACTIVE,
  MOTION_BY_AXES,
  MOTION_MODE,
  MOTION_START,
  MOTION_STRAIGHT,
  MOTION_X,
  MOTION_Y,
  PLAYER_OBJECT,
  WRAM,
} from '../../src/task/wram.mjs';
import { BANK_WRAP } from '../../src/constants/bits.mjs';

const NO_MOTION = 0;

// Shared body of 80:C6F3, C6F8, C716 and C71D: the object (first argument) gets a motion
// towards the object in the second argument: the mode in A (LDA #mode before LDX), X 0,
// the target object in the Y field and the motion started (long indexed, bank carry).
// The flags come from the last LDA #1.
function startMotionToObject(h, motionMode = MOTION_BY_AXES) {
  const mode = h.load(motionMode),
    object = h.index('x', h.dp(FIRST_ARGUMENT));
  h.longWrite(WRAM + MOTION_MODE + object, mode);
  h.longWrite(WRAM + MOTION_X + object, h.load(0));
  h.longWrite(WRAM + MOTION_Y + object, h.load(h.dp(SECOND_ARGUMENT)));
  h.longWrite(WRAM + MOTION_ACTIVE + object, h.load(MOTION_START));
}
// Shared body of 80:C79C and C7A1: the object (first argument) gets a motion towards
// the point (second and third argument, times four as two ASLs): the mode, then X and
// Y, then the motion started (long indexed, bank carry). The flags come from the last
// LDA #1.
function startMotionToPoint(h, motionMode) {
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

// 80:C6F3: move the object (first argument) straight towards the object in the second
// argument (body of 80:C6F8 with mode 0).
export const moveObjectStraightToObjectReference = (a, outerReturn = true) =>
  leaf(a, (h) => startMotionToObject(h, MOTION_STRAIGHT), outerReturn);
// 80:C6F8: move the object (first argument) axis by axis towards the object in the
// second argument.
export const moveObjectToObjectReference = (a, outerReturn = true) =>
  leaf(a, (h) => startMotionToObject(h), outerReturn);
// 80:C716: move the object (first argument) straight towards the player object (0CC2):
// the player object becomes the second argument, then the body of 80:C6F3 follows.
export const moveObjectStraightToPlayerReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const player = h.load(h.longRead(h.abs(PLAYER_OBJECT)));
      a.writeWord(SECOND_ARGUMENT, player, BANK_WRAP, 'leaf-reset-parameter');
      startMotionToObject(h, MOTION_STRAIGHT);
    },
    outerReturn,
  );
// 80:C71D: move the object (first argument) towards the player object (0CC2): the
// player object becomes the second argument, then BRA into the body of 80:C6F8.
export const moveObjectToPlayerReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const player = h.load(h.longRead(h.abs(PLAYER_OBJECT)));
      a.writeWord(SECOND_ARGUMENT, player, BANK_WRAP, 'c71d-DP02');
      startMotionToObject(h);
    },
    outerReturn,
  );
// 80:C79C: move the object (first argument) straight towards the point in the second
// and third argument (body of 80:C7A1 with mode 0).
export const moveObjectStraightToPointReference = (a, outerReturn = true) =>
  leaf(a, (h) => startMotionToPoint(h, MOTION_STRAIGHT), outerReturn);
// 80:C7A1: move the object (first argument) axis by axis towards the point in the
// second and third argument.
export const moveObjectToPointReference = (a, outerReturn = true) =>
  leaf(a, (h) => startMotionToPoint(h, MOTION_BY_AXES), outerReturn);
// 80:C7C2: clear the motion target of the object (first argument).
export const stopMotionReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.longWrite(WRAM + MOTION_ACTIVE + object, h.load(NO_MOTION));
    },
    outerReturn,
  );
