// Palette cycles (docs/ROM-FREE.md, step 2). When 81:8CE0 gives palette n a
// slot s, $81:801A looks n up in the table 8B:FD75 (six entries of a byte n
// and a word pointer in bank 8B; X stops at 12) and copies the record into
// the cycle slots (src/task/main-scene-load.mjs): word 0 | s << 4 to 1CC6
// (first colour; bit 15 runs the cycle backwards), word 2 to 1CCA (DMA
// length in bytes), word 4 to 1CBE (added to 1CC2 each frame, a step when
// bit 7 is reached), word 6 to 1CD2 (steps), record + 8 to 1CCE (colours).
// $81:8076 (src/render/palette-update-8076.mjs) moves the index through 0 to
// steps - 1 and sets 1CDA = colours + 2 index; $81:80C4 sends 1CCA bytes from
// 8B:1CDA by DMA to CGRAM (src/task/main-game-nmi.mjs). A record so holds
// 2 (steps - 1) + length bytes of colours. The six records follow the table
// back to back and end at 8B:FE15, where the part graphics begin.
// Native form assets/vm-palette-cycles.json: per entry the palette number and
// its record (first colour, reverse, length, speed, steps, colours as BGR555
// words). A record keeps its size (palette_cycle_layout_changed).
import { VmFault } from '../vm/memory.mjs';
import { hex, romWriter } from './rom-bytes.mjs';
import {
  BYTE_MASK,
  WORD_MASK,
  BYTE_BITS,
  HEX_RADIX,
  BYTE_HEX_DIGITS,
  WORD_HEX_DIGITS,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { COLOUR_MASK } from '../constants/ppu.mjs';

export const CYCLE_TABLE = 0x8bfd75,
  CYCLES = 6,
  CYCLE_END = 0x8bfe15,
  CYCLE_BANK_BASE = 0x8b0000;
// Table entry: palette byte and record pointer word. Record: four words
// (first colour with bit 15 reverse, length, speed, steps), then the colours.
const ENTRY_BYTES = 3,
  ENTRY_POINTER = 1,
  HEADER_WORDS = 4,
  HEADER_BYTES = 2 * HEADER_WORDS,
  REVERSE = WORD_SIGN,
  FIRST_COLOUR_MASK = WORD_SIGN - 1;
const words = (read8, cpu, n) =>
  Array.from({ length: n }, (_, i) => read8(cpu + 2 * i) | (read8(cpu + 2 * i + 1) << BYTE_BITS));
const size = ({ length, steps }) => HEADER_BYTES + 2 * (steps - 1) + length;
const h4 = (v) => hex(v, WORD_HEX_DIGITS);

export function readPaletteCycles(read8) {
  let next = CYCLE_TABLE + ENTRY_BYTES * CYCLES;
  return Array.from({ length: CYCLES }, (_, n) => {
    const at = CYCLE_TABLE + ENTRY_BYTES * n,
      record =
        CYCLE_BANK_BASE | read8(at + ENTRY_POINTER) | (read8(at + ENTRY_POINTER + 1) << BYTE_BITS);
    const [first, length, speed, steps] = words(read8, record, HEADER_WORDS);
    if (record !== next || length & 1 || !steps)
      throw new VmFault('palette_cycle_layout_required', record);
    const cycle = {
      palette: hex(read8(at), BYTE_HEX_DIGITS),
      first: h4(first & FIRST_COLOUR_MASK),
      reverse: !!(first & REVERSE),
      length: h4(length),
      speed: h4(speed),
      steps,
      colors: words(read8, record + HEADER_BYTES, (2 * (steps - 1) + length) / 2).map(h4),
    };
    next = record + size({ length, steps });
    if (n === CYCLES - 1 && next !== CYCLE_END)
      throw new VmFault('palette_cycle_layout_required', next);
    return cycle;
  });
}

export function placePaletteCycles(rom, present, { cycles }) {
  const put = romWriter(rom, present, 'palette_cycle_layout_changed');
  if (cycles?.length !== CYCLES) throw new VmFault('palette_cycle_layout_changed', CYCLE_TABLE);
  const bytes = [],
    h = (text, digits) => {
      if (!new RegExp(`^[0-9A-F]{${digits}}$`).test(text ?? ''))
        throw new VmFault('palette_cycle_required', CYCLE_TABLE);
      return parseInt(text, HEX_RADIX);
    };
  const word = (v) => bytes.push(v & BYTE_MASK, v >> BYTE_BITS);
  let record = CYCLE_TABLE + ENTRY_BYTES * CYCLES;
  for (const c of cycles) {
    bytes.push(h(c.palette, BYTE_HEX_DIGITS));
    word(record & WORD_MASK);
    record += HEADER_BYTES + 2 * c.colors.length;
  }
  for (const c of cycles) {
    const first = h(c.first, WORD_HEX_DIGITS),
      length = h(c.length, WORD_HEX_DIGITS);
    if (
      first & REVERSE ||
      length & 1 ||
      !Number.isInteger(c.steps) ||
      c.steps < 1 ||
      c.steps > WORD_MASK ||
      2 * c.colors.length !== 2 * (c.steps - 1) + length
    )
      throw new VmFault('palette_cycle_required', CYCLE_TABLE);
    [
      first | (c.reverse ? REVERSE : 0),
      length,
      h(c.speed, WORD_HEX_DIGITS),
      c.steps,
      ...c.colors.map((v) => {
        const w = h(v, WORD_HEX_DIGITS);
        if (w > COLOUR_MASK) throw new VmFault('palette_color_required', CYCLE_TABLE);
        return w;
      }),
    ].forEach(word);
  }
  if (CYCLE_TABLE + bytes.length !== CYCLE_END)
    throw new VmFault('palette_cycle_layout_changed', CYCLE_TABLE + bytes.length);
  bytes.forEach((value, k) => {
    put(CYCLE_TABLE + k, value);
  });
}

// Palette ranges of other sources that lie inside the cycle records belong
// to the cycles (the probe saw 8B:FDE3, 10 bytes of the fifth record).
export const outsideCycles = (ranges) =>
  ranges.filter(([cpu, length]) => {
    if (cpu >= CYCLE_TABLE && cpu + length <= CYCLE_END) return false;
    if (cpu < CYCLE_END && cpu + length > CYCLE_TABLE)
      throw new VmFault('palette_cycle_overlap', cpu);
    return true;
  });
