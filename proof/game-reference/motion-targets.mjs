// Register-level references of the scripts' motion target natives (moved from
// src/task/native-motion-*.mjs and native-object-to-waypoint.mjs; lifted in
// src/game/motion-targets.mjs). The proof plans,
// the Native58 dispatch of proof/task/native-dispatch.mjs and the instruction tests of
// tools/task-native-m1d.test.mjs run these; the game runs the lifted natives.
import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  THIRD_ARGUMENT,
  leaf,
} from '../../src/task/native-leaf-support.mjs';
import {
  DP_POINT_LIST,
  DP_POINT_LIST_BANK,
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
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
import {
  BANK_WRAP,
  LONG_MASK,
  LONG_WRAP,
  WORD_BITS,
  WORD_MASK,
} from '../../src/constants/bits.mjs';
import { FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';

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
// Waypoint entries are 6 bytes; the X word is at entry + 1, the Y word two bytes later.
const WAYPOINT_Y_STEP = 2;

// 80:C6C7..C6F2, the shared tail of 80:C6BF and C6C4: the object (first argument) gets
// a motion with the mode in A towards the waypoint (second argument) of the room's point
// list (long pointer DP F3..F5). The entry offset is 6 * waypoint (three ASLs, SEC,
// two SBCs of the waypoint; the second SBC uses the borrow of the first), then INY
// selects the X word; both coordinates are stored times four.
function startMotionToWaypoint(h) {
  const a = h.a;
  const object = h.index('x', h.dp(FIRST_ARGUMENT));
  h.longWrite(WRAM + MOTION_MODE + object, h.ctx.a);
  h.load(h.dp(SECOND_ARGUMENT));
  h.asl();
  h.asl();
  h.asl();
  h.ctx.status |= FLAG_CARRY;
  h.arithmetic(h.dp(SECOND_ARGUMENT), true);
  h.arithmetic(h.dp(SECOND_ARGUMENT), true);
  h.index('y', h.ctx.a);
  let entry = h.index('y', (h.ctx.y + 1) & WORD_MASK);
  // The long pointer is read fresh for each coordinate, as LDA [F3],Y does.
  const pointer = () =>
    a.readWord(DP_POINT_LIST, BANK_WRAP, 'leaf-long-pointer') |
    (a.read(DP_POINT_LIST_BANK, 'leaf-long-bank') << WORD_BITS);
  for (const target of [MOTION_X, MOTION_Y]) {
    if (target === MOTION_Y) entry = h.index('y', (entry + WAYPOINT_Y_STEP) & WORD_MASK);
    h.load(h.longRead(pointer() + entry));
    h.asl();
    h.asl();
    h.longWrite(WRAM + target + object, h.ctx.a);
  }
  h.longWrite(WRAM + MOTION_ACTIVE + object, h.load(MOTION_START));
}

// 80:C6C4: move the object (first argument) axis by axis towards the waypoint in the
// second argument.
export const moveObjectToWaypointReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.load(MOTION_BY_AXES);
      startMotionToWaypoint(h);
    },
    outerReturn,
  );

// 80:C6BF: move the object (first argument) straight towards the waypoint in the
// second argument.
export const moveObjectStraightToWaypointReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.load(MOTION_STRAIGHT);
      startMotionToWaypoint(h);
    },
    outerReturn,
  );
// 80:D105: place the object (first argument) on the waypoint (second argument) of the
// room's point list and stop its motion. The entry offset is 6 * waypoint as in
// startMotionToWaypoint above; X, Y and height follow at
// entry + 1, + 3 and + 5 (INY twice between them), each stored times four. The long
// pointer DP F3..F5 is read fresh for each word.
export const placeObjectOnWaypointReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(h.dp(SECOND_ARGUMENT));
      h.asl();
      h.asl();
      h.asl();
      h.ctx.status |= FLAG_CARRY;
      h.arithmetic(h.dp(SECOND_ARGUMENT), true);
      h.arithmetic(h.dp(SECOND_ARGUMENT), true);
      h.index('y', h.ctx.a);
      let entry = h.index('y', (h.ctx.y + 1) & WORD_MASK);
      for (const field of [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT]) {
        const pointer =
          a.readWord(DP_POINT_LIST, BANK_WRAP, 'position-fresh-pointer') |
          (a.read(DP_POINT_LIST_BANK, 'position-fresh-bank') << WORD_BITS);
        h.load(a.readWord((pointer + entry) & LONG_MASK, LONG_WRAP, 'position-indirect-WORD'));
        h.asl();
        h.asl();
        h.longWrite(h.abs(field) + object, h.ctx.a);
        if (field !== OBJECT_HEIGHT) {
          h.index('y', (entry + 1) & WORD_MASK);
          entry = h.index('y', (entry + 2) & WORD_MASK);
        }
      }
      h.longWrite(WRAM + MOTION_ACTIVE + object, h.load(0));
    },
    outerReturn,
  );
