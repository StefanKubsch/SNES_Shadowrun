// The distance between two objects as scripts ask for it (lifted from the script natives
// 80:C694 and 80:C68D with their shared body 80:C696; register-level references in
// proof/game-reference/script-measures.mjs).
//
// The distance is the larger of the X and Y position differences' magnitudes, a quarter
// of it (positions are in quarter units): both differences wrap in 16 bits and a
// difference of 8000 stays 8000. The positions lie at 7E:0E28 and 7E:0E80 plus the slot
// through the data bank 80 (src/system/data-bank.mjs).
import { dataBankWord } from '../system/data-bank.mjs';
import { PLAYER_OBJECT } from '../data/wram.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { objectWord } from '../state/objects.mjs';

const QUARTER_SHIFT = 2;

// The magnitude of a 16-bit difference as the original forms it.
function magnitude(mem, field, object, other) {
  const difference = (objectWord(mem, field, object) - objectWord(mem, field, other)) & WORD_MASK;
  return difference & WORD_SIGN ? -difference & WORD_MASK : difference;
}

// 80:C694: the distance between the objects.
export const objectDistance = (mem, object, other) =>
  Math.max(magnitude(mem, 'x', object, other), magnitude(mem, 'y', object, other)) >>>
  QUARTER_SHIFT;
// 80:C68D: the object's distance to the player figure.
export const distanceToPlayer = (mem, object) =>
  objectDistance(mem, object, dataBankWord(mem, PLAYER_OBJECT));
