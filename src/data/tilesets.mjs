// Tilesets of the scene records (docs/ROM-FREE.md, step 2). $81:A117 takes the
// tileset byte n of a scene record and sets DP 11 = $8D:F1A0 + 2 n (blocks)
// and DP 14 = $8D:F1AC + 2 n (attributes), both in bank 8D
// (src/task/main-scene-load.mjs). For each grid cell $81:8EDF reads block b:
// - the attribute byte at [14] + b, mapped by 8CE0 to the palette bits of
//   the tilemap words (palette slot, 7F:C980),
// - eight words at [11] + 16 b, written to the layer at 7E:76A8 + 76A8,
//   7728, 77A8, 7828 (left column, rows 0-3) and 76AA, 772A, 77AA, 782A
//   (right column); a zero word leaves its cell empty, others are interned
//   by 8E57 (bits 14-15 are compared with XOR C000).
// The six tilesets lie back to back from 8D:D0B0: blocks of tileset n, then
// its attributes, then tileset n + 1; the last ends at 8D:F1A0 where the
// pointer tables begin, and those end at 8D:F1B8 where the palette table
// begins. The block count of each tileset is (attributes - blocks) / 16 and
// equals the attribute bytes up to the next tileset (128, 80, 80, 24, 80,
// 104).
// Native form assets/vm-tilesets.json: per tileset its blocks, each with the
// attribute byte and the eight words in hex as four rows of two (left, right).
import { VmFault } from '../vm/memory.mjs';
import { romWriter, wordReader } from './rom-bytes.mjs';
import { BYTE_MASK, WORD_MASK, BYTE_BITS, HEX_RADIX, WORD_HEX_DIGITS } from '../constants/bits.mjs';

export const TILESET_BLOCKS = 0x8df1a0,
  TILESET_ATTRIBUTES = 0x8df1ac,
  TILESETS = 6,
  TILESET_DATA = 0x8dd0b0;
export const TILESET_END = TILESET_ATTRIBUTES + 2 * TILESETS;

const hex4 = (v) => v.toString(HEX_RADIX).toUpperCase().padStart(WORD_HEX_DIGITS, '0');

const TILESET_BANK_BASE = 0x8d0000,
  BLOCK_ROWS = 4,
  BLOCK_WORDS = 2 * BLOCK_ROWS,
  BLOCK_BYTES = 2 * BLOCK_WORDS;

export function readTilesets(read8) {
  const word = wordReader(read8);
  const tilesets = [];
  let next = TILESET_DATA;
  for (let n = 0; n < TILESETS; n++) {
    const blocks = TILESET_BANK_BASE | word(TILESET_BLOCKS + 2 * n),
      attributes = TILESET_BANK_BASE | word(TILESET_ATTRIBUTES + 2 * n);
    const count = (attributes - blocks) / BLOCK_BYTES;
    if (blocks !== next || !Number.isInteger(count) || count <= 0)
      throw new VmFault('tileset_layout_required', blocks);
    next = attributes + count;
    tilesets.push({
      blocks: Array.from({ length: count }, (_, b) => {
        const at = blocks + BLOCK_BYTES * b,
          w = (i) => hex4(word(at + 2 * i));
        return {
          attribute: read8(attributes + b),
          rows: Array.from({ length: BLOCK_ROWS }, (_, r) => `${w(r)} ${w(BLOCK_ROWS + r)}`),
        };
      }),
    });
  }
  if (next !== TILESET_BLOCKS) throw new VmFault('tileset_layout_required', next);
  return tilesets;
}

// Writes the tilesets back to back from 8D:D0B0 and both pointer tables; the
// data must end before 8D:F1A0, and no byte may be present already.
export function placeTilesets(rom, present, { tilesets }) {
  if (tilesets.length !== TILESETS) throw new VmFault('tilesets_required');
  const put = romWriter(rom, present, 'tileset_layout_changed');
  const word = (cpu, value) => {
    put(cpu, value & BYTE_MASK);
    put(cpu + 1, value >> BYTE_BITS);
  };
  let at = TILESET_DATA;
  tilesets.forEach(({ blocks }, n) => {
    if (!blocks.length) throw new VmFault('tileset_blocks_required', n);
    const attributes = at + BLOCK_BYTES * blocks.length;
    if (attributes + blocks.length > TILESET_BLOCKS) throw new VmFault('tileset_layout_changed', n);
    word(TILESET_BLOCKS + 2 * n, at & WORD_MASK);
    word(TILESET_ATTRIBUTES + 2 * n, attributes & WORD_MASK);
    blocks.forEach(({ attribute, rows }, b) => {
      const words = rows.map((r) => r.split(' '));
      if (
        words.length !== BLOCK_ROWS ||
        words.some((r) => r.length !== 2 || r.some((v) => !/^[0-9A-F]{4}$/.test(v)))
      )
        throw new VmFault('tileset_words_required', n);
      if (!Number.isInteger(attribute) || attribute < 0 || attribute > BYTE_MASK)
        throw new VmFault('tileset_attribute_required', n);
      for (let i = 0; i < BLOCK_WORDS; i++)
        word(
          at + BLOCK_BYTES * b + 2 * i,
          parseInt(words[i % BLOCK_ROWS][Math.floor(i / BLOCK_ROWS)], HEX_RADIX),
        );
      put(attributes + b, attribute);
    });
    at = attributes + blocks.length;
  });
}
