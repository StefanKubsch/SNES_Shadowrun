// Object types of the scene records (docs/ROM-FREE.md, step 2). The type of a
// scene object indexes the word table $8A:C36A; the word points to the type's
// definition in bank 8A. Readers: $81:903E draws the parts
// (src/task/main-scene-layers.mjs), $81:84DE builds the collision boxes
// (src/task/main-scene-collision.mjs). A definition is
// - a header of 8 bytes: byte 0 the number of parts; the words at 1 and 3,
//   added by 903E to its screen field (DP 2C) for an unflipped or flipped
//   object; the word at 5, added to DP 2F; byte 7 the number of boxes,
// - per part 5 bytes (903E): a word whose bits 0-14 select the graphic in the
//   table $96:C3FA (3 bytes per entry) and whose bit 15 flips it; a byte
//   added to the column (DP 38); a byte added as the high byte of DP 38
//   (subtracted when the object is flipped); a byte added to DP 2F,
// - per box 6 bytes (84DE): for each of three axes, in the order of the DP
//   fields 1A, 1D and 20 (1A and 1D swap for a flipped object), a signed
//   start byte (84CF) and an unsigned size byte.
// The 548 definitions lie back to back in type order from 8A:883E and end
// exactly at the table, which has one ascending pointer per type and ends at
// 8A:C7B2, where a packed stream begins.
// Native form assets/vm-objects.json: per type its header words in hex,
// parts and boxes.
import { VmFault } from '../vm/memory.mjs';
import { romWriter, wordReader } from './rom-bytes.mjs';
import {
  BYTE_MASK,
  WORD_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_HEX_DIGITS,
  BYTE_VALUES,
  INT8_MAX,
  INT8_MIN,
  WORD_SIGN,
} from '../constants/bits.mjs';

export const OBJECT_TABLE = 0x8ac36a,
  OBJECT_TYPES = 548,
  OBJECT_DATA = 0x8a883e,
  OBJECT_BANK_BASE = 0x8a0000;
// Header: part count, the screen field words (unflipped, flipped), the DP 2F
// word, the box count.
const HEADER_PART_COUNT = 0,
  HEADER_OFFSET = 1,
  HEADER_OFFSET_FLIPPED = 3,
  HEADER_OFFSET_2F = 5,
  HEADER_BOX_COUNT = 7,
  HEADER_BYTES = 8;
// Part: graphic word (bit 15 flips it), column, row and depth bytes.
const PART_BYTES = 5,
  PART_COLUMN = 2,
  PART_ROW = 3,
  PART_DEPTH = 4,
  PART_FLIP = WORD_SIGN,
  PART_GRAPHIC_MASK = WORD_SIGN - 1;
// Box: signed start and size byte per axis x, y, z.
const BOX_BYTES = 6,
  BOX_X_SIZE = 1,
  BOX_Y = 2,
  BOX_Y_SIZE = 3,
  BOX_Z = 4,
  BOX_Z_SIZE = 5;

const hex4 = (v) => v.toString(HEX_RADIX).toUpperCase().padStart(WORD_HEX_DIGITS, '0');
const signed = (v) => (v > INT8_MAX ? v - BYTE_VALUES : v);

export function readObjectTypes(read8) {
  const word = wordReader(read8);
  const types = [];
  let next = OBJECT_DATA;
  for (let n = 0; n < OBJECT_TYPES; n++) {
    const at = OBJECT_BANK_BASE | word(OBJECT_TABLE + 2 * n);
    if (at !== next) throw new VmFault('object_layout_required', at);
    const parts = Array.from({ length: read8(at + HEADER_PART_COUNT) }, (_, i) => {
      const p = at + HEADER_BYTES + PART_BYTES * i,
        w = word(p);
      return {
        graphic: w & PART_GRAPHIC_MASK,
        flip: !!(w & PART_FLIP),
        column: read8(p + PART_COLUMN),
        row: read8(p + PART_ROW),
        depth: read8(p + PART_DEPTH),
      };
    });
    const first = at + HEADER_BYTES + PART_BYTES * parts.length;
    const boxes = Array.from({ length: read8(at + HEADER_BOX_COUNT) }, (_, i) => {
      const b = first + BOX_BYTES * i;
      return {
        x: signed(read8(b)),
        x_size: read8(b + BOX_X_SIZE),
        y: signed(read8(b + BOX_Y)),
        y_size: read8(b + BOX_Y_SIZE),
        z: signed(read8(b + BOX_Z)),
        z_size: read8(b + BOX_Z_SIZE),
      };
    });
    types.push({
      offset: hex4(word(at + HEADER_OFFSET)),
      offset_flipped: hex4(word(at + HEADER_OFFSET_FLIPPED)),
      offset_2f: hex4(word(at + HEADER_OFFSET_2F)),
      parts,
      boxes,
    });
    next = first + BOX_BYTES * boxes.length;
  }
  if (next !== OBJECT_TABLE) throw new VmFault('object_layout_required', next);
  return types;
}

const need = (ok, reason, n) => {
  if (!ok) throw new VmFault(reason, n);
};
const inRange = (v, low, high) => Number.isInteger(v) && v >= low && v <= high;

// Writes the definitions back to back from 8A:883E and the table; they must
// end before the table, and no byte may be present already.
export function placeObjectTypes(rom, present, { types }) {
  need(types.length === OBJECT_TYPES, 'object_types_required');
  const put = romWriter(rom, present, 'object_layout_changed');
  const word = (cpu, value) => {
    put(cpu, value & BYTE_MASK);
    put(cpu + 1, value >> BYTE_BITS);
  };
  const hex = (text, n) => {
    need(new RegExp(`^[0-9A-F]{${WORD_HEX_DIGITS}}$`).test(text), 'object_header_required', n);
    return parseInt(text, HEX_RADIX);
  };
  let at = OBJECT_DATA;
  types.forEach((t, n) => {
    need(t.parts.length < BYTE_VALUES && t.boxes.length < BYTE_VALUES, 'object_count_required', n);
    const end = at + HEADER_BYTES + PART_BYTES * t.parts.length + BOX_BYTES * t.boxes.length;
    need(end <= OBJECT_TABLE, 'object_layout_changed', n);
    word(OBJECT_TABLE + 2 * n, at & WORD_MASK);
    put(at + HEADER_PART_COUNT, t.parts.length);
    word(at + HEADER_OFFSET, hex(t.offset, n));
    word(at + HEADER_OFFSET_FLIPPED, hex(t.offset_flipped, n));
    word(at + HEADER_OFFSET_2F, hex(t.offset_2f, n));
    put(at + HEADER_BOX_COUNT, t.boxes.length);
    t.parts.forEach((p, i) => {
      need(
        inRange(p.graphic, 0, PART_GRAPHIC_MASK) &&
          [p.column, p.row, p.depth].every((v) => inRange(v, 0, BYTE_MASK)),
        'object_part_required',
        n,
      );
      const q = at + HEADER_BYTES + PART_BYTES * i;
      word(q, p.graphic | (p.flip ? PART_FLIP : 0));
      put(q + PART_COLUMN, p.column);
      put(q + PART_ROW, p.row);
      put(q + PART_DEPTH, p.depth);
    });
    t.boxes.forEach((b, i) => {
      need(
        [b.x, b.y, b.z].every((v) => inRange(v, INT8_MIN, INT8_MAX)) &&
          [b.x_size, b.y_size, b.z_size].every((v) => inRange(v, 0, BYTE_MASK)),
        'object_box_required',
        n,
      );
      const q = at + HEADER_BYTES + PART_BYTES * t.parts.length + BOX_BYTES * i;
      [b.x & BYTE_MASK, b.x_size, b.y & BYTE_MASK, b.y_size, b.z & BYTE_MASK, b.z_size].forEach(
        (v, k) => put(q + k, v),
      );
    });
    at = end;
  });
}
