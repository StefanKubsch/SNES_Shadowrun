// Object pictures in banks 9B and 9C (docs/ROM-FREE.md, step 2). A frame
// word of an action record (src/data/actions.mjs) or a new picture pointer
// in 1140 names picture P; 80:ACD0 (src/task/native-scene-tiles.mjs) reads:
// - P +0 the tile count n; the slot chain of the object grows or shrinks
//   to n (12A0);
// - n pairs of words (queueTiles, tables AEB4/AEC4): each a 64-byte OBJ
//   character source for the NMI 81:A964 (4312 = word & FFC0, 4314 = 8E +
//   bits 0-5, 4315 = 40), the first and second half of a slot;
// - then the layout L (7E:3F80), read by 80:B20A (native-scene-sprites.mjs):
//   L +0 width and L +1 height (each times 2 to DP 1A/1D), L +2 rows in the
//   high and columns in the low nibble, then one byte per cell, columns
//   first: bit 5 empty (no slot), bits 6-7 the OBJ flip bits. ACD0 takes
//   bits 0-2 of the first cell to F88; when they are not 0 it also reads
//   the byte before P, signed times 4, to FE0 (the shadow byte here).
// The empty cells match the tile count in all 2329 pictures the actions
// name, and those pictures with their shadow bytes fill 9B:8001 to 9B:C256
// and 9C:8000 to 9C:D066 without a gap; scripts follow in both banks.
// Pictures are named by address (frames, 1140), so each keeps its address
// and size (picture_layout_changed).
// Native form assets/vm-pictures.json: per picture address, shadow (signed
// or null), tiles (pairs of character addresses), width, height, rows,
// columns, cells.
import { VmFault } from '../vm/memory.mjs';
import { label, romWriter } from './rom-bytes.mjs';
import {
  BYTE_MASK,
  BYTE_BITS,
  HEX_RADIX,
  WORD_BITS,
  BYTE_SIGN,
  INT8_MAX,
  INT8_MIN,
  NIBBLE_BITS,
  NIBBLE_MASK,
} from '../constants/bits.mjs';

export const PICTURE_RUNS = [
  [0x9b8001, 0x9bc256],
  [0x9c8000, 0x9cd066],
];
// Tile word: a 64-byte OBJ character at bank 8E + bits 0-5, offset word & FFC0.
const SOURCE_FIRST_BANK = 0x8e,
  SOURCE_BANK_MASK = 0x3f,
  SOURCE_OFFSET_MASK = 0xffc0,
  SOURCE_BYTES = 64;
// Picture: tile count, two tile words per tile, then the layout: width,
// height, rows (high nibble) and columns (low nibble), one byte per cell
// (bit 5 empty; bits 0-2 of the first cell select the shadow byte before P).
const TILE_PAIR_BYTES = 4,
  LAYOUT_HEIGHT = 1,
  LAYOUT_GRID = 2,
  LAYOUT_CELLS = 3,
  CELL_EMPTY = 0x20,
  CELL_SHADOW = 0x07,
  GRID_MAX = NIBBLE_MASK;
const tile = (w) =>
  label(((SOURCE_FIRST_BANK + (w & SOURCE_BANK_MASK)) << WORD_BITS) | (w & SOURCE_OFFSET_MASK));

function readPicture(read8, p) {
  const n = read8(p),
    word = (c) => read8(c) | (read8(c + 1) << BYTE_BITS),
    L = p + 1 + TILE_PAIR_BYTES * n;
  const tiles = Array.from({ length: n }, (_, k) => [
    tile(word(p + 1 + TILE_PAIR_BYTES * k)),
    tile(word(p + 1 + 2 + TILE_PAIR_BYTES * k)),
  ]);
  const rows = read8(L + LAYOUT_GRID) >> NIBBLE_BITS,
    columns = read8(L + LAYOUT_GRID) & NIBBLE_MASK;
  const cells = Array.from({ length: rows * columns }, (_, k) => read8(L + LAYOUT_CELLS + k));
  if (cells.filter((c) => !(c & CELL_EMPTY)).length !== n || !cells.length)
    throw new VmFault('picture_layout_required', p);
  const shadow = cells[0] & CELL_SHADOW ? (read8(p - 1) ^ BYTE_SIGN) - BYTE_SIGN : null;
  return {
    picture: {
      address: label(p),
      shadow,
      tiles,
      width: read8(L),
      height: read8(L + LAYOUT_HEIGHT),
      rows,
      columns,
      cells,
    },
    start: shadow === null ? p : p - 1,
    end: L + LAYOUT_CELLS + cells.length,
  };
}

// Every picture start that a frame names, read run by run.
export function readPictures(read8, frames) {
  const starts = [...new Set(frames)]
    .map((t) => parseInt(t.replace(':', ''), HEX_RADIX))
    .sort((a, b) => a - b);
  const pictures = [];
  for (const [start, end] of PICTURE_RUNS) {
    let at = start;
    for (const p of starts.filter((p) => p >= start && p < end)) {
      const r = readPicture(read8, p);
      if (r.start !== at) throw new VmFault('picture_layout_required', p);
      pictures.push(r.picture);
      at = r.end;
    }
    if (at !== end) throw new VmFault('picture_layout_required', at);
  }
  return pictures;
}

// The 64-byte OBJ character sources the pictures name, as [cpu, 64, 'obj4']
// ranges for src/data/vram-tiles.mjs.
export const pictureSources = (pictures) =>
  [...new Set(pictures.flatMap((p) => p.tiles.flat()))].map((t) => [
    parseInt(t.replace(':', ''), HEX_RADIX),
    SOURCE_BYTES,
    'obj4',
  ]);

export function placePictures(rom, present, { pictures }) {
  if (!Array.isArray(pictures)) throw new VmFault('picture_layout_changed', PICTURE_RUNS[0][0]);
  const write = romWriter(rom, present, 'picture_layout_changed');
  let placed = 0;
  for (const pic of pictures) {
    const m = /^(9B|9C):([89A-F][0-9A-F]{3})$/.exec(pic?.address ?? '');
    if (!m) throw new VmFault('picture_value_required', 0);
    const p = parseInt(m[1] + m[2], HEX_RADIX),
      fail = () => {
        throw new VmFault('picture_value_required', p);
      };
    const byte = (v) => (Number.isInteger(v) && v >= 0 && v <= BYTE_MASK ? v : fail());
    const source = (t) => {
      const s = /^([89][0-9A-F]):([89A-F][0-9A-F]{3})$/.exec(t ?? '') ?? fail(),
        bank = parseInt(s[1], HEX_RADIX) - SOURCE_FIRST_BANK,
        o = parseInt(s[2], HEX_RADIX);
      return bank < 0 || bank > SOURCE_BANK_MASK || o & ~SOURCE_OFFSET_MASK ? fail() : o | bank;
    };
    const { tiles, rows, columns, cells, shadow } = pic;
    if (
      !Array.isArray(tiles) ||
      !Array.isArray(cells) ||
      !Number.isInteger(rows) ||
      !Number.isInteger(columns) ||
      rows < 0 ||
      rows > GRID_MAX ||
      columns < 0 ||
      columns > GRID_MAX ||
      cells.length !== rows * columns ||
      !cells.length
    )
      fail();
    if (
      cells.map(byte).filter((c) => !(c & CELL_EMPTY)).length !== tiles.length ||
      tiles.length > BYTE_MASK
    )
      fail();
    if (
      (cells[0] & CELL_SHADOW) !== 0
        ? !(Number.isInteger(shadow) && shadow >= INT8_MIN && shadow <= INT8_MAX)
        : shadow !== null
    )
      fail();
    const bytes = [
      tiles.length,
      ...tiles.flatMap((pair) =>
        (pair?.length === 2 ? pair : fail()).flatMap((t) => {
          const w = source(t);
          return [w & BYTE_MASK, w >> BYTE_BITS];
        }),
      ),
      byte(pic.width),
      byte(pic.height),
      (rows << NIBBLE_BITS) | columns,
      ...cells,
    ];
    const first = shadow === null ? p : p - 1;
    if (!PICTURE_RUNS.some(([a, b]) => first >= a && p + bytes.length <= b))
      throw new VmFault('picture_layout_changed', p);
    if (shadow !== null) write(p - 1, shadow & BYTE_MASK);
    bytes.forEach((v, k) => write(p + k, v));
    placed += bytes.length + (shadow !== null);
  }
  if (placed !== PICTURE_RUNS.reduce((s, [a, b]) => s + b - a, 0))
    throw new VmFault('picture_layout_changed', PICTURE_RUNS[0][0]);
}
