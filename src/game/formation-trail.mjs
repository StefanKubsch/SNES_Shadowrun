// The formation trail of the player figure (lifted from 80:BAD5; register-level
// reference in proof/game-reference/main-camera.mjs). The room entry clears the
// trail (80:BABB, room-entry.mjs).
//
// The group follows the player figure along a ring of 64 steps (7E:44A8 on: x, y,
// height and direction words). Each pass of the main loop compares the figure's
// position with the newest step; when it moved, and no hit shakes it, the ring index
// 7E:0D18 goes back one step (wrapping to the last) and takes the position and the
// direction, and the unmoved word 7E:0D1A is cleared. Otherwise the unmoved word is
// set to FFFF.
//
// The original reads the figure's tables through its data bank 80, with the slot as
// a 16-bit index that wraps within the low WRAM mirror (the slot FFFF, no figure,
// reads the word before each table); the ring is indexed long in bank 7E.
import { taskStop } from '../system/task-stop.mjs';
import {
  FORMATION_DIRECTION,
  FORMATION_HEIGHT,
  FORMATION_INDEX,
  FORMATION_LAST,
  FORMATION_UNMOVED,
  FORMATION_X,
  FORMATION_Y,
  PLAYER_HIT_FRAMES,
  PLAYER_OBJECT,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { OBJECT_FIELDS, isObjectSlot, objectWordIn, readStateWord } from '../state/objects.mjs';

const UNMOVED = WORD_MASK,
  LOW_WRAM_END = 0x2000;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// A field of the figure at slot, through the data bank 80 for a value that is no slot.
function objectWord(wram, name, slot) {
  if (isObjectSlot(slot)) return objectWordIn(wram, name, slot);
  const at = (OBJECT_FIELDS[name] + slot) & WORD_MASK;
  if (at + 1 >= LOW_WRAM_END) taskStop('object_slot_required', { slot });
  return readStateWord(wram, at);
}

// Record a step of the player figure (80:BAD5). Game state only (user decision
// 2026-11-17): the ring index and slot the original leaves in X and Y are not produced.
export function recordFormationStep(wram) {
  if (word(wram, PLAYER_HIT_FRAMES)) {
    setWord(wram, FORMATION_UNMOVED, UNMOVED);
    return;
  }
  const slot = word(wram, PLAYER_OBJECT);
  let index = word(wram, FORMATION_INDEX);
  const fields = ['x', 'y', 'height'].map((name) => objectWord(wram, name, slot));
  // The comparison stops at the first field that differs.
  const moved =
    fields[0] !== word(wram, FORMATION_X + index) ||
    fields[1] !== word(wram, FORMATION_Y + index) ||
    fields[2] !== word(wram, FORMATION_HEIGHT + index);
  if (!moved) {
    setWord(wram, FORMATION_UNMOVED, UNMOVED);
    return;
  }
  index = (index - 2) & WORD_MASK;
  if (index & WORD_SIGN) index = FORMATION_LAST;
  setWord(wram, FORMATION_INDEX, index);
  setWord(wram, FORMATION_X + index, fields[0]);
  setWord(wram, FORMATION_Y + index, fields[1]);
  setWord(wram, FORMATION_HEIGHT + index, fields[2]);
  setWord(wram, FORMATION_DIRECTION + index, objectWord(wram, 'direction', slot));
  setWord(wram, FORMATION_UNMOVED, 0);
}
