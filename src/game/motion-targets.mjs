// The motion targets scripts give objects (lifted from the script natives 80:C6F3,
// 80:C6F8, 80:C716, 80:C71D, 80:C79C, 80:C7A1 and 80:C7C2; register-level references in
// proof/game-reference/motion-targets.mjs).
//
// An object's motion (src/task/native-motion-*.mjs runs it each frame) has a mode (0
// straight, 1 axis by axis) at 7E:4138, a target at 7E:4190 and 7E:41E8 and a state at
// 7E:40E0 (1: started, 0: none), each plus the object's slot as a long index (a slot near
// FFFF reaches bank 7F). Towards an object the target holds X 0 and the target object in
// Y; towards a point it holds the point's X and Y times four. Towards the player the
// player figure's slot (7E:0CC2, through the data bank 80) is also left in the second
// argument word, as the original does.
import { dataBankWord } from '../system/data-bank.mjs';
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
} from '../task/wram.mjs';
import { LONG_MASK, WORD_MASK } from '../constants/bits.mjs';

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
