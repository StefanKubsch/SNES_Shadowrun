// The palette cycles of the main loop (lifted from 81:8076; register-level reference
// in proof/game-reference/main-upkeep.mjs).
//
// Two cycles (slots 0 and 1) turn through a table of palettes. Each pass a slot adds
// its step to its progress; when bit 7 is reached the progress keeps its lower seven
// bits and the cycle moves its index one palette on (or back, with bit 15 of the
// direction), wrapping at the count. It then asks for that palette: the request
// pointer (the table plus twice the index) and the slot, which the game NMI uploads.
// Only one cycle asks per pass: the slot that asks ends the pass, and a zero step
// ends it too, the second slot included.
import {
  PALETTE_COUNT,
  PALETTE_DIRECTION,
  PALETTE_INDEX,
  PALETTE_PROGRESS,
  PALETTE_REQUEST_POINTER,
  PALETTE_REQUEST_SLOT,
  PALETTE_STEP,
  PALETTE_TABLE,
} from '../task/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  BYTE_SIGN,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

const SLOTS = 2,
  READY = BYTE_SIGN;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Advance the palette cycles (81:8076). Returns the slot offset it ended at (0 or 2,
// or 4 after both progressed), the X the original leaves.
export function advancePaletteCycles(wram) {
  for (let slot = 0; slot < SLOTS; slot++) {
    const x = slot * 2,
      step = word(wram, PALETTE_STEP + x);
    if (!step) return x;
    const progress = (step + word(wram, PALETTE_PROGRESS + x)) & WORD_MASK;
    if (!(progress & READY)) {
      setWord(wram, PALETTE_PROGRESS + x, progress);
      continue;
    }
    setWord(wram, PALETTE_PROGRESS + x, progress & (READY - 1));
    const old = word(wram, PALETTE_INDEX + x);
    let index;
    if (word(wram, PALETTE_DIRECTION + x) & WORD_SIGN)
      index = ((old === 0 ? word(wram, PALETTE_COUNT + x) : old) - 1) & WORD_MASK;
    else {
      index = (old + 1) & WORD_MASK;
      if (index === word(wram, PALETTE_COUNT + x)) index = 0;
    }
    setWord(wram, PALETTE_INDEX + x, index);
    // Twice the index with its bit 15 as the carry into the table address.
    const twice = ((index << 1) & WORD_MASK) + (index >>> (WORD_BITS - 1));
    setWord(wram, PALETTE_REQUEST_POINTER, twice + word(wram, PALETTE_TABLE + x));
    setWord(wram, PALETTE_REQUEST_SLOT, x);
    return x;
  }
  return SLOTS * 2;
}
