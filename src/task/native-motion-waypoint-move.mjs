import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import {
  MOTION_ACTIVE,
  MOTION_BY_AXES,
  MOTION_MODE,
  MOTION_START,
  MOTION_STRAIGHT,
  MOTION_X,
  MOTION_Y,
  WRAM,
  DP_POINT_LIST,
  DP_POINT_LIST_BANK,
} from './wram.mjs';
import { WORD_MASK, BANK_WRAP, WORD_BITS } from '../constants/bits.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';

// Waypoint entries are 6 bytes; the X word is at entry + 1, the Y word two bytes later.
const WAYPOINT_Y_STEP = 2;

// 80:C6C7..C6F2, the shared tail of 80:C6BF and C6C4: the object (first argument) gets
// a motion with the mode in A towards the waypoint (second argument) of the room's point
// list (long pointer DP F3..F5). The entry offset is 6 * waypoint (three ASLs, SEC,
// two SBCs of the waypoint; the second SBC uses the borrow of the first), then INY
// selects the X word; both coordinates are stored times four.
export function startMotionToWaypoint(h) {
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
export const moveObjectToWaypoint = (a, outerReturn = true) =>
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
export const moveObjectStraightToWaypoint = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.load(MOTION_STRAIGHT);
      startMotionToWaypoint(h);
    },
    outerReturn,
  );
