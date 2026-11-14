// The text font 95:F2D0 to F740 (docs/ROM-FREE.md, step 2): 142 characters of
// 8 x 8 pixels at one bit each, eight row bytes per character code, bit 7 on
// the left. The text composition (proof/render/text-compose.mjs, FB2A) reads
// 95:F2D0 + 8 * code row by row; the glyphs sit at the right edge, their
// widths are glyph_widths 81:AC0C (src/data/tables.mjs). Native form: an
// indexed BMP of 16 characters per row (128 x 72), pixel 15 for a set bit
// and 0 for a clear one; the two cells after the last character stay 0.
import { VmFault } from '../vm/memory.mjs';
import { romWriter } from './rom-bytes.mjs';
import { BYTE_SIGN } from '../constants/bits.mjs';
import { TILE_SIZE } from '../constants/ppu.mjs';

// A glyph: eight row bytes, bit 7 on the left; the sheet holds 16 glyphs per row
// with pixel INK for a set bit.
const GLYPH_BYTES = TILE_SIZE,
  GLYPHS_PER_ROW = 16,
  INK = 15;
export const FONT = 0x95f2d0,
  FONT_GLYPHS = 142,
  FONT_END = FONT + GLYPH_BYTES * FONT_GLYPHS;
export const FONT_WIDTH = GLYPHS_PER_ROW * TILE_SIZE,
  FONT_HEIGHT = TILE_SIZE * Math.ceil(FONT_GLYPHS / GLYPHS_PER_ROW);
const pixelAt = (glyph, row, bit) =>
  (Math.floor(glyph / GLYPHS_PER_ROW) * TILE_SIZE + row) * FONT_WIDTH +
  (glyph % GLYPHS_PER_ROW) * TILE_SIZE +
  bit;

export function readFont(read8) {
  const pixels = new Uint8Array(FONT_WIDTH * FONT_HEIGHT);
  for (let g = 0; g < FONT_GLYPHS; g++)
    for (let row = 0; row < TILE_SIZE; row++) {
      const v = read8(FONT + GLYPH_BYTES * g + row);
      for (let bit = 0; bit < TILE_SIZE; bit++)
        if (v & (BYTE_SIGN >> bit)) pixels[pixelAt(g, row, bit)] = INK;
    }
  return pixels;
}

export function placeFont(rom, present, { width, height, pixels }) {
  const put = romWriter(rom, present, 'font_layout_changed');
  if (width !== FONT_WIDTH || height !== FONT_HEIGHT)
    throw new VmFault('font_layout_changed', FONT);
  if (pixels.some((p) => p !== 0 && p !== INK)) throw new VmFault('font_pixel_required', FONT);
  for (let g = FONT_GLYPHS; g < (GLYPHS_PER_ROW * FONT_HEIGHT) / TILE_SIZE; g++)
    for (let row = 0; row < TILE_SIZE; row++)
      for (let bit = 0; bit < TILE_SIZE; bit++)
        if (pixels[pixelAt(g, row, bit)]) throw new VmFault('font_layout_changed', FONT_END);
  for (let g = 0; g < FONT_GLYPHS; g++)
    for (let row = 0; row < TILE_SIZE; row++) {
      let v = 0;
      for (let bit = 0; bit < TILE_SIZE; bit++)
        if (pixels[pixelAt(g, row, bit)]) v |= BYTE_SIGN >> bit;
      put(FONT + GLYPH_BYTES * g + row, v);
    }
}
