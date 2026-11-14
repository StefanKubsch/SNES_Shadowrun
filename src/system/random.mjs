// Random numbers (lifted from 80:C51F and 80:C560; long form 80:F2A8, register-level
// version in src/task/native-random.mjs). A random byte mixes the last byte, the
// frame counter word and the horizontal and vertical beam counters through the
// permutation random_bytes; a number below a range takes two such bytes as a word,
// masks it to the range's bit length (random_masks) and draws again until it fits.
import { decodeOnce, tableEntries } from '../data/named-tables.mjs';
import { DP_RANDOM_MASK, RANDOM_BYTE, RANDOM_STATE, RANDOM_STATE_HIGH } from '../task/wram.mjs';
import { OPHCT, OPVCT, SLHV } from '../constants/hardware-registers.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_SIGN } from '../constants/bits.mjs';

// The direct page words of 80:C51F: the range (and the draw) and the range's copy.
const DP_DRAW = 0,
  DP_RANGE = 2;

// Original instructions, the sites of the device model: the latch (its value is
// not used), then the horizontal and the vertical counter byte.
const LATCH_SITE = 0x80c566,
  HORIZONTAL_SITE = 0x80c572,
  VERTICAL_SITE = 0x80c57f;

const tables = (mem) =>
  decodeOnce(mem, 'random', (image) => ({
    bytes: tableEntries(image, 'random_bytes'),
    masks: tableEntries(image, 'random_masks'),
  }));

// The next random byte pair as a word (80:C560); keeps the last byte in RANDOM_BYTE.
// registers (optional) receives the Y the original leaves: the table index of the
// high byte (the low byte mixed with the horizontal counter).
export function randomWord(mem, port, registers = null) {
  const { wram } = mem,
    { bytes } = tables(mem);
  port.read(SLHV, 1, LATCH_SITE);
  const low = bytes[wram[RANDOM_BYTE]] ^ wram[RANDOM_STATE];
  const index = low ^ port.read(OPHCT, 1, HORIZONTAL_SITE),
    high = bytes[index] ^ wram[RANDOM_STATE_HIGH];
  if (registers) registers.y = index;
  let last = high ^ port.read(OPVCT, 1, VERTICAL_SITE);
  // The new byte never repeats the last one.
  if (last === wram[RANDOM_BYTE]) last = (last + 1) & BYTE_MASK;
  wram[RANDOM_BYTE] = last;
  return low | (high << BYTE_BITS);
}
// The mask of a nonzero range's bit length, which a draw is cut to.
export function rangeMask(mem, range) {
  let bits = 0;
  while (!((range << bits) & WORD_SIGN)) bits++;
  return tables(mem).masks[bits];
}
// A random number from 0 to range - 1 (0 for a range of 0); registers as randomWord.
// counter (optional) receives the number of random words drawn in counter.draws.
export function randomBelow(mem, port, range, registers = null, counter = null) {
  if (range === 0) return 0;
  const mask = rangeMask(mem, range);
  let value;
  do {
    value = randomWord(mem, port, registers) & mask;
    if (counter) counter.draws = (counter.draws ?? 0) + 1;
  } while (value >= range);
  return value;
}
// 80:C51F as its callers see it in the direct page (data bank 80, direct page 0): a draw
// below range into DP 00, which also keeps the range in DP 02 and its mask in DP 04 (a
// range of 0 leaves them and draws 0); returns the draw.
export function drawBelowInDirectPage(mem, port, range) {
  const { wram } = mem,
    setWord = (at, value) => {
      wram[at] = value & BYTE_MASK;
      wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
    };
  setWord(DP_DRAW, range);
  if (range === 0) return 0;
  const value = randomBelow(mem, port, range);
  setWord(DP_RANGE, range);
  setWord(DP_RANDOM_MASK, rangeMask(mem, range));
  setWord(DP_DRAW, value);
  return value;
}
