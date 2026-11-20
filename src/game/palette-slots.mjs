// The object palette slots of the sprite list (lifted from 80:AB0A and 81:A840;
// register-level references runPaletteSlot in proof/replay/native-scene-sprites.mjs and
// clearPaletteSlots in proof/system/main-initialize.mjs).
//
// Each pass the sprite list empties the palette upload list 7E:17D4 and unsets every
// object palette's slot 7E:17E6 (81:A840, clearPaletteSlots in game-screen.mjs). Every drawn object's palette then gets a slot
// (80:AB0A): an unset one (sign set) takes the next free one, the upload list's length
// in bytes, and the palette's own offset is appended to the upload list, which the NMI
// copies into the sprite colours. The OAM entry reads the slot as its palette bits.
//
// Registers (user decision 2026-11-17): game state only. The palette is a parameter
// (A in the original) and the slot the return value; no A, X or flags are left (both
// callers overwrite them). The new slot keeps the palette offset in the direct page
// word 6B as the original.
import { taskStop } from '../system/task-stop.mjs';
import { PALETTE_SLOTS, PALETTE_UPLOAD_LIST, PALETTE_UPLOAD_LIST_BYTES } from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const LOW_WRAM_END = 0x2000,
  ENTRY_BYTES = 2,
  // The direct page word that keeps the palette offset.
  DP_PALETTE = 0x6b;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
// A word of a table in the caller's data bank 80, which reaches WRAM below 2000.
const at = (base, index) => {
  if (base + index + 1 >= LOW_WRAM_END) taskStop('palette_slot_required', { base, index });
  return base + index;
};

// The slot of the palette (80:AB0A, called with JSR): returns the slot after its RTS.
export function paletteSlot(h, palette) {
  const { wram } = h.a.mem,
    offset = (palette << 1) & WORD_MASK;
  let slot = word(wram, at(PALETTE_SLOTS, offset));
  if (slot & WORD_SIGN) {
    slot = word(wram, PALETTE_UPLOAD_LIST_BYTES);
    setWord(wram, at(PALETTE_SLOTS, offset), slot);
    setWord(wram, DP_PALETTE, offset);
    setWord(wram, at(PALETTE_UPLOAD_LIST, slot), offset);
    setWord(wram, PALETTE_UPLOAD_LIST_BYTES, (slot + ENTRY_BYTES) & WORD_MASK);
  }
  h.rts();
  return slot;
}
