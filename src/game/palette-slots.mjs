// The object palette slots of the sprite list (lifted from 80:AB0A and 81:A840;
// register-level references runPaletteSlot in src/task/native-scene-sprites.mjs and
// clearPaletteSlots in src/task/main-initialize.mjs).
//
// Each pass the sprite list empties the palette upload list 7E:17D4 and unsets every
// object palette's slot 7E:17E6 (81:A840). Every drawn object's palette then gets a slot
// (80:AB0A): an unset one (sign set) takes the next free one, the upload list's length
// in bytes, and the palette's own offset is appended to the upload list, which the NMI
// copies into the sprite colours. The OAM entry reads the slot as its palette bits.
//
// A, X and the flags are left as the original leaves them: the slot clear A = FFFF; the
// slot A = the slot and X the palette offset when it was set, else X the new list
// length with its sign and zero. The new slot keeps the palette offset in the direct
// page word 6B as the original.
import { taskStop } from '../task/plan.mjs';
import { clearPaletteSlots } from './game-screen.mjs';
import { PALETTE_SLOTS, PALETTE_UPLOAD_LIST, PALETTE_UPLOAD_LIST_BYTES } from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const LOW_WRAM_END = 0x2000,
  ENTRY_BYTES = 2,
  UNSET = WORD_MASK,
  // The direct page word that keeps the palette offset.
  DP_PALETTE = 0x6b;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
};
// A word of a table in the caller's data bank 80, which reaches WRAM below 2000.
const at = (base, index) => {
  if (base + index + 1 >= LOW_WRAM_END) taskStop('palette_slot_required', { base, index });
  return base + index;
};

// Unset all palette slots (81:A840, called with JSL).
export function resetPaletteSlots(h) {
  clearPaletteSlots(h.a.mem.wram);
  h.ctx.a = UNSET;
  signAndZero(h.ctx, UNSET);
  return h.rtl();
}

// The slot of the palette in A (80:AB0A, called with JSR), returned in A.
export function paletteSlot(h) {
  const { ctx } = h,
    { wram } = h.a.mem,
    // ASL: the palette offset, the carry its top bit.
    offset = (ctx.a << 1) & WORD_MASK;
  flag(ctx, FLAG_CARRY, ctx.a & WORD_SIGN);
  ctx.x = offset;
  const slot = word(wram, at(PALETTE_SLOTS, offset));
  if (!(slot & WORD_SIGN)) {
    ctx.a = slot;
    signAndZero(ctx, slot);
    return h.rts();
  }
  const fresh = word(wram, PALETTE_UPLOAD_LIST_BYTES);
  setWord(wram, at(PALETTE_SLOTS, offset), fresh);
  setWord(wram, DP_PALETTE, offset);
  setWord(wram, at(PALETTE_UPLOAD_LIST, fresh), offset);
  const length = (fresh + ENTRY_BYTES) & WORD_MASK;
  setWord(wram, PALETTE_UPLOAD_LIST_BYTES, length);
  ctx.a = fresh;
  ctx.x = length;
  signAndZero(ctx, length);
  return h.rts();
}
