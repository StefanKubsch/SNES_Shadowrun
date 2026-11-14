// Uncompressed VRAM characters (docs/ROM-FREE.md, step 2): the ROM ranges that
// the game sends by general DMA straight to VRAM, with their format from the
// probe over all live tests (analysis/rom-vram.json, tools/rom-vram-hook.mjs):
// obj4 are OBJ characters with 4 bits per pixel (Book I, OBJ data), bg2 and
// bg4 BG characters with 2 and 4 bits per pixel (BG3 and BG1/BG2 in mode 1).
// A character is 8x8 pixels in planar form, addressed as in
// src/video/ppu-frame.mjs (Book I appendix A): row y of plane p is byte
// (p >> 1) * 16 + y * 2 + (p & 1), bit 7 is the left pixel; 32 bytes with 4
// planes, 16 with 2.
// Native form: one indexed BMP per format (src/data/tiles.mjs, pixel = colour
// index), 16 characters per row; each range starts on a new row of its sheet,
// in the order of assets/vm-vram.json, which names address, format and number
// of characters per range. The sheet helpers also serve the unpacked streams
// (src/data/lz-streams.mjs).
import { VmFault } from '../vm/memory.mjs';
import { romOffset } from './rom-bytes.mjs';
import { WORD_MASK, HEX_RADIX, WORD_BITS } from '../constants/bits.mjs';
import { LOROM_OFFSET } from '../constants/memory-map.mjs';
import { PLANE_PAIR_BYTES, TILE_SIZE } from '../constants/ppu.mjs';

export const VRAM_FORMATS = { obj4: 4, bg4: 4, bg2: 2 };
export const VRAM_SHEET_WIDTH = 128;
const PER_ROW = VRAM_SHEET_WIDTH / 8;

export const planes = (format) => {
  const bpp = VRAM_FORMATS[format];
  if (!bpp) throw new VmFault('vram_format_required');
  return bpp;
};
const rowsOf = (n) => Math.ceil(n / PER_ROW);

// Character n of an item whose first character is on sheet row `row`.
const origin = (row, n) => [(n % PER_ROW) * TILE_SIZE, (row + Math.floor(n / PER_ROW)) * TILE_SIZE];
// Byte of plane p in row y of a character.
const planeByte = (p, y) => (p >> 1) * PLANE_PAIR_BYTES + y * 2 + (p & 1);
const LEFT_PIXEL_BIT = TILE_SIZE - 1;

// The sheet height and first row of each item ({format, tiles}), per format.
function vramLayout(items) {
  const rows = Object.fromEntries(Object.keys(VRAM_FORMATS).map((f) => [f, 0]));
  const first = items.map(({ format, tiles }) => {
    planes(format);
    const row = rows[format];
    rows[format] += rowsOf(tiles);
    return row;
  });
  return {
    first,
    heights: Object.fromEntries(Object.entries(rows).map(([f, r]) => [f, r * TILE_SIZE])),
  };
}

// Characters of each item ({format, bytes}) into one pixel sheet per used format.
export function charactersToSheets(items) {
  const list = items.map(({ format, bytes }) => {
    const unit = planes(format) * TILE_SIZE;
    if (bytes.length % unit) throw new VmFault('vram_length_required');
    return { format, tiles: bytes.length / unit };
  });
  const { first, heights } = vramLayout(list),
    sheets = {};
  for (const [format, height] of Object.entries(heights))
    if (height) sheets[format] = new Uint8Array(VRAM_SHEET_WIDTH * height);
  items.forEach(({ format, bytes }, i) => {
    const bpp = planes(format),
      pixels = sheets[format];
    for (let n = 0; n < list[i].tiles; n++) {
      const [x0, y0] = origin(first[i], n),
        at = n * bpp * TILE_SIZE;
      for (let y = 0; y < TILE_SIZE; y++)
        for (let x = 0; x < TILE_SIZE; x++) {
          let v = 0;
          for (let p = 0; p < bpp; p++)
            v |= ((bytes[at + planeByte(p, y)] >> (LEFT_PIXEL_BIT - x)) & 1) << p;
          pixels[(y0 + y) * VRAM_SHEET_WIDTH + x0 + x] = v;
        }
    }
  });
  return { tiles: list.map((l) => l.tiles), sheets };
}

// The bytes of each item ({format, tiles}) from the sheets ({width, height, pixels} per format).
export function sheetsToCharacters(items, sheets) {
  const { first, heights } = vramLayout(items);
  for (const [format, height] of Object.entries(heights)) {
    const sheet = sheets[format];
    if (height && (!sheet || sheet.width !== VRAM_SHEET_WIDTH || sheet.height !== height))
      throw new VmFault('vram_sheet_size_required');
  }
  return items.map(({ format, tiles }, i) => {
    const bpp = planes(format),
      pixels = sheets[format].pixels,
      bytes = new Uint8Array(tiles * bpp * TILE_SIZE);
    for (let n = 0; n < tiles; n++) {
      const [x0, y0] = origin(first[i], n),
        at = n * bpp * TILE_SIZE;
      for (let y = 0; y < TILE_SIZE; y++)
        for (let x = 0; x < TILE_SIZE; x++) {
          const v = pixels[(y0 + y) * VRAM_SHEET_WIDTH + x0 + x];
          if (v >> bpp) throw new VmFault('vram_pixel_range_required', i);
          for (let p = 0; p < bpp; p++)
            bytes[at + planeByte(p, y)] |= ((v >> p) & 1) << (LEFT_PIXEL_BIT - x);
        }
    }
    return bytes;
  });
}

// C06B (proof/render/object-c06b.mjs) sends 2 x 40 bytes of OBJ characters from
// 8D:FB78, FBF8 or FC78 by the gate 7E:01E8; the probe saw only FB78 and FBF8.
export const C06B_SOURCES = [0x8dfb78, 0x8dfbf8, 0x8dfc78].map((cpu) => [cpu, 0x80, 'obj4']);

// [cpu, length, format] ranges in address order, overlapping or touching
// ranges of one format and bank joined (the probe ranges, the character
// sources of the object pictures, src/data/pictures.mjs, and C06B_SOURCES).
export function mergeVramRanges(ranges) {
  const out = [];
  for (const [cpu, length, format] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = out.at(-1);
    if (last && cpu <= last[0] + last[1] && cpu >> WORD_BITS === last[0] >> WORD_BITS) {
      if (last[2] !== format) throw new VmFault('vram_format_conflict', cpu);
      last[1] = Math.max(last[1], cpu + length - last[0]);
    } else out.push([cpu, length, format]);
  }
  return out;
}

// From the ROM view (read8 at CPU addresses): sheets per format from
// [cpu, length, format] ranges.
export function readVramTiles(read8, ranges) {
  const { tiles, sheets } = charactersToSheets(
    ranges.map(([cpu, length, format]) => ({
      format,
      bytes: Uint8Array.from({ length }, (_, n) => read8(cpu + n)),
    })),
  );
  return { ranges: ranges.map(([cpu, , format], i) => ({ cpu, format, tiles: tiles[i] })), sheets };
}

// Writes the characters from the sheets to rom; each range keeps its address
// and must not overwrite a byte already present.
export function placeVramTiles(rom, present, { ranges }, sheets) {
  sheetsToCharacters(ranges, sheets).forEach((bytes, i) => {
    const cpu = parseInt(ranges[i].address.replace(':', ''), HEX_RADIX);
    bytes.forEach((value, k) => {
      const address = cpu + k,
        o = romOffset(address);
      if ((address & WORD_MASK) < LOROM_OFFSET || present[o])
        throw new VmFault('vram_layout_changed', address);
      rom[o] = value;
      present[o] = 1;
    });
  });
}
