// The motion targets scripts give objects (lifted from the script natives 80:C6F3,
// 80:C6F8, 80:C716, 80:C71D, 80:C79C, 80:C7A1, 80:C7C2, 80:C6BF, 80:C6C4 and 80:D105;
// register-level references in proof/game-reference/motion-targets.mjs).
//
// An object's motion (src/task/native-motion-*.mjs runs it each frame) has a mode (0
// straight, 1 axis by axis) at 7E:4138, a target at 7E:4190 and 7E:41E8 and a state at
// 7E:40E0 (1: started, 0: none), each plus the object's slot as a long index (a slot near
// FFFF reaches bank 7F). Towards an object the target holds X 0 and the target object in
// Y; towards a point it holds the point's X and Y times four. Towards the player the
// player figure's slot (7E:0CC2, through the data bank 80) is also left in the second
// argument word, as the original does.
//
// The room's waypoints lie in its point list (the long pointer at direct page F3 to F5),
// six bytes each: a byte, then the X, Y and height words over 4. The original forms the
// entry offset 6 * waypoint as 8 * waypoint minus the waypoint twice, the second
// subtraction taking the first one's borrow, all in 16 bits.
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
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
} from '../task/wram.mjs';
import { BYTE_BITS, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const NO_MOTION = 0,
  POINT_SCALE = 4;

const setField = (mem, field, object, value) =>
  mem.write16((WRAM + field + object) & LONG_MASK, value);

function startMotion(mem, object, mode, x, y) {
  setField(mem, MOTION_MODE, object, mode);
  setField(mem, MOTION_X, object, x);
  setField(mem, MOTION_Y, object, y);
  setField(mem, MOTION_ACTIVE, object, MOTION_START);
}

// 80:C6F3 (straight) and 80:C6F8 (axis by axis): move the object towards target.
export const moveToObject = (mem, object, target, straight = false) =>
  startMotion(mem, object, straight ? MOTION_STRAIGHT : MOTION_BY_AXES, 0, target);
// 80:C716 (straight) and 80:C71D (axis by axis): move the object towards the player
// figure; returns the player's slot for the second argument word.
export function moveToPlayer(mem, object, straight = false) {
  const player = dataBankWord(mem, PLAYER_OBJECT);
  moveToObject(mem, object, player, straight);
  return player;
}
// 80:C79C (straight) and 80:C7A1 (axis by axis): move the object towards the point x, y.
export const moveToPoint = (mem, object, x, y, straight = false) =>
  startMotion(
    mem,
    object,
    straight ? MOTION_STRAIGHT : MOTION_BY_AXES,
    (x * POINT_SCALE) & WORD_MASK,
    (y * POINT_SCALE) & WORD_MASK,
  );
// 80:C7C2: stop the object's motion.
export const stopMotion = (mem, object) => setField(mem, MOTION_ACTIVE, object, NO_MOTION);

const WAYPOINT_SHIFT = 3,
  // The X, Y and height words after the waypoint's first byte.
  WAYPOINT_FIELDS = [1, 3, 5];
// The point list offset of the waypoint as the original forms it.
function waypointEntry(waypoint) {
  const first = ((waypoint << WAYPOINT_SHIFT) & WORD_MASK) - waypoint,
    borrow = first < 0 ? 1 : 0;
  return (first & WORD_MASK) - waypoint - borrow;
}
// The word at offset of the waypoint's entry in the point list, times four.
function waypointWord(mem, waypoint, offset) {
  const { wram } = mem,
    list =
      wram[DP_POINT_LIST] |
      (wram[DP_POINT_LIST + 1] << BYTE_BITS) |
      (wram[DP_POINT_LIST_BANK] << WORD_BITS);
  return (
    (mem.read16((list + ((waypointEntry(waypoint) + offset) & WORD_MASK)) & LONG_MASK) *
      POINT_SCALE) &
    WORD_MASK
  );
}
// 80:C6BF (straight) and 80:C6C4 (axis by axis): move the object towards the waypoint.
export function moveToWaypoint(mem, object, waypoint, straight = false) {
  const [x, y] = WAYPOINT_FIELDS.map((offset) => waypointWord(mem, waypoint, offset));
  startMotion(mem, object, straight ? MOTION_STRAIGHT : MOTION_BY_AXES, x, y);
}
// 80:D105: place the object on the waypoint and stop its motion.
export function placeOnWaypoint(mem, object, waypoint) {
  [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT].forEach((field, n) =>
    setDataBankWord(mem, field, object, waypointWord(mem, waypoint, WAYPOINT_FIELDS[n])),
  );
  stopMotion(mem, object);
}
