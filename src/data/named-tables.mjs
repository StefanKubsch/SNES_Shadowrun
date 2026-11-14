// Lookup tables of the loaded image by name, for lifted code (docs/MATRIX-LIFT.md):
// the entries of a table of LOOKUP_TABLES (src/data/tables.mjs) as plain
// unsigned numbers, read from the image so edited table assets apply.
import { LOOKUP_TABLES } from './tables.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';

const WIDTHS = { 1: 1, 2: 2, 4: 4, s2: 2, hex: 2, text: 2, pointer: 2, long: 3 };
const BY_NAME = new Map(LOOKUP_TABLES.map((t) => [t.name, t]));

// The entries of the table name: bytes, words (signed values in two's complement)
// or longer numbers, little-endian as in the image.
export function tableEntries(mem, name) {
  const { address, size, count } = BY_NAME.get(name),
    width = WIDTHS[size];
  return Array.from({ length: count }, (_, n) => {
    let value = 0;
    for (let b = width - 1; b >= 0; b--)
      value = value * (1 << BYTE_BITS) + mem.read8(address + n * width + b);
    return value;
  });
}
// The result of decode(mem), computed once per loaded image (the ROM bytes behind
// the memory) and key.
const decoded = new WeakMap();
export function decodeOnce(mem, key, decode) {
  let byKey = decoded.get(mem.rom);
  if (!byKey) decoded.set(mem.rom, (byKey = new Map()));
  if (!byKey.has(key)) byKey.set(key, decode(mem));
  return byKey.get(key);
}
