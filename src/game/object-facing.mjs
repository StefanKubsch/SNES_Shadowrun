import { readStateByte, writeStateByte } from '../state/objects.mjs';
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
//
// The return words of the natives' JSRs to the direction body and the turn lie only in
// free stack bytes and are not reproduced (game state only, user decision 2026-11-17).
import { turnObject } from './object-turn.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { PLAYER_OBJECT } from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { objectWord } from '../state/objects.mjs';

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

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// The direction from the object towards the target (80:D1E3 and the body of 80:CF93),
// with the magnitudes and sign words left in the direct page.
function directionTowards(mem, object, target) {
  const { wram } = mem,
    axis = (field, minus, distance) => {
      const difference =
          (objectWord(mem, field, target) - objectWord(mem, field, object)) & WORD_MASK,
        negative = (difference & WORD_SIGN) !== 0;
      setWord(wram, minus, negative ? difference : 0);
      setWord(wram, distance, negative ? -difference & WORD_MASK : difference);
    };
  setWord(wram, DP_MINUS_X, 0);
  setWord(wram, DP_MINUS_Y, 0);
  axis('x', DP_MINUS_X, DP_DISTANCE_X);
  axis('y', DP_MINUS_Y, DP_DISTANCE_Y);
  const distanceX = word(wram, DP_DISTANCE_X),
    distanceY = word(wram, DP_DISTANCE_Y),
    minusX = word(wram, DP_MINUS_X) !== 0,
    minusY = word(wram, DP_MINUS_Y) !== 0;
  if (distanceY >>> 1 >= distanceX) return minusY ? MINUS_Y : PLUS_Y;
  if (distanceX >>> 1 >= distanceY) return minusX ? MINUS_X : PLUS_X;
  if (minusX) return minusY ? MINUS_X_MINUS_Y : MINUS_X_PLUS_Y;
  return minusY ? PLUS_X_MINUS_Y : PLUS_X_PLUS_Y;
}
// The direction body 80:D1E3 towards the player object.
const directionToPlayer = (mem) =>
  directionTowards(mem, word(mem.wram, DP_OBJECT), dataBankWord(mem, PLAYER_OBJECT));
// The turn 80:AAAF of the object in word 00 to the direction in word 02.
function turnCall(mem, direction) {
  setWord(mem.wram, DP_TARGET, direction);
  turnObject(mem, mem.wram);
}

// 80:CF93: the object (word 00) turns towards the object in word 02, unless its low byte
// is FF.
export function turnTowardsObject(mem) {
  const { wram } = mem,
    target = word(wram, DP_TARGET);
  if ((target & BYTE_MASK) === NO_TARGET) return;
  turnCall(mem, directionTowards(mem, word(wram, DP_OBJECT), target));
}
// 80:D1D2: the object (word 00) turns towards the player object.
export function turnTowardsPlayer(mem) {
  turnCall(mem, directionToPlayer(mem));
}
// 80:D1DD: the direction from the object (word 00) towards the player object, returned in
// word 00.
export function getDirectionToPlayer(mem) {
  setWord(mem.wram, DP_OBJECT, directionToPlayer(mem));
}
