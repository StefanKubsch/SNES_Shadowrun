// Turning an object towards another object or the player object (lifted from the script
// natives 80:CF93, 80:D1D2 and 80:D1DD with their direction body 80:D1E3; register-level
// references in proof/game-reference/object-facing.mjs).
//
// The direction from an object towards a target follows the differences target minus
// object of X (7E:0E28) and Y (7E:0E80) as wrapped words: a negative difference is kept
// as the axis's sign word (direct page A8 and AB, else 0) and its magnitude negated
// (A2 and A5). One axis dominates when half the other's magnitude is not below its own;
// otherwise the two signs pick a diagonal. The directions: 0 plus Y, 2 plus X, 4 minus Y,
// 6 minus X, the diagonals between them.
import { turnObject } from './object-turn.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { OBJECT_X, OBJECT_Y, PLAYER_OBJECT } from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// The direct page: the object and the target (or the direction), the magnitudes and the
// sign words of the target offset.
const DP_OBJECT = 0,
  DP_TARGET = 2,
  DP_DISTANCE_X = 0xa2,
  DP_DISTANCE_Y = 0xa5,
  DP_MINUS_X = 0xa8,
  DP_MINUS_Y = 0xab;
const PLUS_Y = 0,
  PLUS_X_PLUS_Y = 1,
  PLUS_X = 2,
  PLUS_X_MINUS_Y = 3,
  MINUS_Y = 4,
  MINUS_X_MINUS_Y = 5,
  MINUS_X = 6,
  MINUS_X_PLUS_Y = 7;
// A target low byte FF: no object to turn towards (80:CF93).
const NO_TARGET = 0xff;
// The return words of the JSRs (the bank offsets of their last bytes): 80:CF93 to the
// turn, 80:D1D2 to the direction and the turn, 80:D1DD to the direction.
const FACE_TURN_RETURN = 0xd014,
  PLAYER_DIRECTION_RETURN = 0xd1d4,
  PLAYER_TURN_RETURN = 0xd1db,
  DIRECTION_RETURN = 0xd1df;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// The direction from the object towards the target (80:D1E3 and the body of 80:CF93),
// with the magnitudes and sign words left in the direct page.
function directionTowards(mem, object, target) {
  const { wram } = mem,
    axis = (field, minus, distance) => {
      const difference =
          (dataBankWord(mem, field, target) - dataBankWord(mem, field, object)) & WORD_MASK,
        negative = (difference & WORD_SIGN) !== 0;
      setWord(wram, minus, negative ? difference : 0);
      setWord(wram, distance, negative ? -difference & WORD_MASK : difference);
    };
  setWord(wram, DP_MINUS_X, 0);
  setWord(wram, DP_MINUS_Y, 0);
  axis(OBJECT_X, DP_MINUS_X, DP_DISTANCE_X);
  axis(OBJECT_Y, DP_MINUS_Y, DP_DISTANCE_Y);
  const distanceX = word(wram, DP_DISTANCE_X),
    distanceY = word(wram, DP_DISTANCE_Y),
    minusX = word(wram, DP_MINUS_X) !== 0,
    minusY = word(wram, DP_MINUS_Y) !== 0;
  if (distanceY >>> 1 >= distanceX) return minusY ? MINUS_Y : PLUS_Y;
  if (distanceX >>> 1 >= distanceY) return minusX ? MINUS_X : PLUS_X;
  if (minusX) return minusY ? MINUS_X_MINUS_Y : MINUS_X_PLUS_Y;
  return minusY ? PLUS_X_MINUS_Y : PLUS_X_PLUS_Y;
}
// The direction body 80:D1E3 called with a JSR whose return word is site.
function directionToPlayer(mem, a, site) {
  a.pushWord(site);
  const direction = directionTowards(
    mem,
    word(mem.wram, DP_OBJECT),
    dataBankWord(mem, PLAYER_OBJECT),
  );
  a.pullWord();
  return direction;
}
// The turn 80:AAAF of the object in word 00 to the direction in word 02, called with a
// JSR whose return word is site.
function turnCall(mem, a, site, direction) {
  setWord(mem.wram, DP_TARGET, direction);
  a.pushWord(site);
  turnObject(mem, mem.wram);
  a.pullWord();
}

// 80:CF93: the object (word 00) turns towards the object in word 02, unless its low byte
// is FF; a is the accessor whose stack takes the call frames.
export function turnTowardsObject(mem, a) {
  const { wram } = mem,
    target = word(wram, DP_TARGET);
  if ((target & BYTE_MASK) === NO_TARGET) return;
  turnCall(mem, a, FACE_TURN_RETURN, directionTowards(mem, word(wram, DP_OBJECT), target));
}
// 80:D1D2: the object (word 00) turns towards the player object.
export function turnTowardsPlayer(mem, a) {
  turnCall(mem, a, PLAYER_TURN_RETURN, directionToPlayer(mem, a, PLAYER_DIRECTION_RETURN));
}
// 80:D1DD: the direction from the object (word 00) towards the player object, returned in
// word 00.
export function getDirectionToPlayer(mem, a) {
  setWord(mem.wram, DP_OBJECT, directionToPlayer(mem, a, DIRECTION_RETURN));
}
