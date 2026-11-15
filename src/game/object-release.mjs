// Releasing an object (lifted from the script natives 80:AA4C and 80:A8F5; register-level
// references in proof/game-reference/object-release.mjs).
//
// 80:AA4C clears the box, motion, picture and animation fields of the object in the
// direct page word 00 and returns its chain of VRAM slots to the free list (each slot
// goes to the list's head; the free count grows by the object's count). 80:A8F5 does
// that, then marks the object's kind free (FFFF) and takes it off the draw list: the
// list's last index drops by one word and the entries from the end down to the object's
// move down by one.
//
// Memory is reached as the original reaches it: the box, motion, picture, clock and kind
// fields long in bank 7E, the other fields and the VRAM slot and draw list tables through
// the data bank, all with a 24-bit index, and the slot countdown in the direct page word
// 17. A script's damaged object index thus reaches what the original reaches. The
// return word of A8F5's JSR to AA4C lies on the stack as in the original. A draw list
// without the object, whose search the original never ends, stops at the frontier
// `draw_list_object_required` after a full turn of the index.
import { taskStop } from '../system/task-stop.mjs';
import {
  ANIMATION_CLOCK_START,
  DRAW_LIST,
  DRAW_LIST_INDEX,
  MOTION_ACTIVE,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_ANIMATION_CLOCK,
  OBJECT_BOX_HEIGHT,
  OBJECT_BOX_X1,
  OBJECT_BOX_X2,
  OBJECT_BOX_Y1,
  OBJECT_BOX_Y2,
  OBJECT_FRAME_REPEATS,
  OBJECT_KIND,
  OBJECT_PICTURE,
  OBJECT_PICTURE_CHANGE,
  OBJECT_SELECTION,
  OBJECT_VRAM_SLOT_COUNT,
  OBJECT_VRAM_SLOT_HEAD,
  VRAM_SLOT_COUNT,
  VRAM_SLOT_FREE_LIST,
  VRAM_SLOT_NEXT,
  WRAM,
} from '../data/wram.mjs';
import { LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

// The direct page: the object and the countdown of the VRAM slots still to free.
const DP_OBJECT = 0,
  DP_SLOTS_LEFT = 0x17;
// The return word of A8F5's JSR to AA4C (the bank offset of its last byte).
const RELEASE_RETURN = 0xa8f7;
// A free object kind.
const FREE_KIND = WORD_MASK;
// The draw list search steps one word; a full turn of the 16-bit index.
const ENTRY_BYTES = 2,
  INDEX_TURN = (WORD_MASK + 1) / ENTRY_BYTES;

// A word long in bank 7E or through the data bank at offset (24-bit addresses).
const setWramWord = (mem, offset, value) => mem.write16((WRAM + offset) & LONG_MASK, value);
const bankAddress = (a, offset) => ((a.ctx.bank << WORD_BITS) + offset) & LONG_MASK;
const bankWord = (a, offset) => a.mem.read16(bankAddress(a, offset));
const setBankWord = (a, offset, value) => a.mem.write16(bankAddress(a, offset), value & WORD_MASK);
// A direct page word (direct page 0).
const directWord = (mem, offset) => mem.read16Bank0(offset);
const setDirectWord = (mem, offset, value) => mem.write16Bank0(offset, value & WORD_MASK);

// 80:AA4C: clear the graphics fields of the object in word 00 and free its VRAM slots.
export function releaseObjectGraphics(mem, a) {
  const object = directWord(mem, DP_OBJECT);
  for (const field of [
    OBJECT_BOX_X1,
    OBJECT_BOX_X2,
    OBJECT_BOX_Y1,
    OBJECT_BOX_Y2,
    OBJECT_BOX_HEIGHT,
    MOTION_ACTIVE,
  ])
    setWramWord(mem, field + object, 0);
  setBankWord(a, OBJECT_PICTURE_CHANGE + object, 0);
  setWramWord(mem, OBJECT_PICTURE + object, 0);
  setBankWord(a, OBJECT_ACTION_DIRECTIONS + object, 0);
  setBankWord(a, OBJECT_SELECTION + object, WORD_MASK);
  setWramWord(mem, OBJECT_ANIMATION_CLOCK + object, ANIMATION_CLOCK_START);
  setWramWord(mem, OBJECT_FRAME_REPEATS + object, 1);
  const count = bankWord(a, OBJECT_VRAM_SLOT_COUNT + object);
  if (count === 0) return;
  setDirectWord(mem, DP_SLOTS_LEFT, count);
  setBankWord(a, VRAM_SLOT_COUNT, count + bankWord(a, VRAM_SLOT_COUNT));
  do {
    const slot = bankWord(a, OBJECT_VRAM_SLOT_HEAD + object);
    setBankWord(a, OBJECT_VRAM_SLOT_HEAD + object, bankWord(a, VRAM_SLOT_NEXT + slot));
    const free = bankWord(a, VRAM_SLOT_FREE_LIST);
    setBankWord(a, VRAM_SLOT_FREE_LIST, slot);
    setBankWord(a, VRAM_SLOT_NEXT + slot, free);
    setDirectWord(mem, DP_SLOTS_LEFT, directWord(mem, DP_SLOTS_LEFT) - 1);
  } while (directWord(mem, DP_SLOTS_LEFT) !== 0);
  setBankWord(a, OBJECT_VRAM_SLOT_COUNT + object, 0);
}

// 80:A8F5: release the object in word 00 (AA4C), free its kind and take it off the draw
// list.
export function removeObject(mem, a) {
  a.pushWord(RELEASE_RETURN);
  releaseObjectGraphics(mem, a);
  a.pullWord();
  setWramWord(mem, OBJECT_KIND + directWord(mem, DP_OBJECT), FREE_KIND);
  let index = bankWord(a, DRAW_LIST_INDEX);
  setBankWord(a, DRAW_LIST_INDEX, bankWord(a, DRAW_LIST_INDEX) - 1);
  setBankWord(a, DRAW_LIST_INDEX, bankWord(a, DRAW_LIST_INDEX) - 1);
  // Each entry from the end down moves one word down until the object's entry is
  // overwritten.
  let carried = bankWord(a, DRAW_LIST + index);
  for (let step = 0; carried !== directWord(mem, DP_OBJECT); step++) {
    if (step === INDEX_TURN) taskStop('draw_list_object_required');
    index = (index - ENTRY_BYTES) & WORD_MASK;
    const entry = bankWord(a, DRAW_LIST + index);
    setBankWord(a, DRAW_LIST + index, carried);
    carried = entry;
  }
}
