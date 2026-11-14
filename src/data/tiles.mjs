// Room tiles (docs/ROM-FREE.md, step 2): $81:A1E1 (src/task/main-scene-graphics.mjs)
// fetches for tile id the word id/4*2 from the table $8D:A41F, the bank
// $82 + bits 10-13 of id*4, and unpacks 128 bytes from pointer + 2 with $80:9E7E
// (src/data/lz.mjs). The table has 1536 entries, 256 per bank $82-$87; the
// streams follow each other without gaps per bank from $xx:8000.
// A stream is four 8x8 tiles of 4 bits, 32 bytes each, plane by plane:
// byte p*8 + y is plane p of row y, bit 7 the left pixel ($81:9AE6 writes
// the VRAM words from it).
// Native form: per bank an indexed BMP (256 x 256, 8 bits, pixels 0-15,
// grey palette; the room palette is stored elsewhere), tile n at (n % 32, n / 32),
// and assets/vm-tiles.json with the address and decomposition per stream.
import { VmFault } from '../vm/memory.mjs';
import { lzBits, lzDecode, lzEncode } from './lz.mjs';
import { placedReader, romWriter } from './rom-bytes.mjs';
import { BYTE_MASK, WORD_MASK, BYTE_BITS, HEX_RADIX, WORD_BITS } from '../constants/bits.mjs';
import { TILE_SIZE } from '../constants/ppu.mjs';

export const TILE_TABLE = 0x8da41f,
  TILE_STREAMS = 1536,
  TILE_BANK = 0x82,
  STREAM_BYTES = 128;
const SHEET = 256,
  PER_ROW = 32;
// A stream holds four 4-bit tiles of 32 bytes; plane p of row y is byte p * 8 + y.
const TILES_PER_STREAM = 4,
  TILE_PLANES = 4,
  TILE_BYTES = 32,
  PIXEL_MAX = (1 << TILE_PLANES) - 1,
  LEFT_PIXEL_BIT = TILE_SIZE - 1;
const tileOrigin = (stream, t) => {
  const n = (stream & BYTE_MASK) * TILES_PER_STREAM + t;
  return [(n % PER_ROW) * TILE_SIZE, Math.floor(n / PER_ROW) * TILE_SIZE];
};

// 128 bytes of a stream <-> pixels of the four tiles n0..n0+3 in a sheet.
export function streamToSheet(data, pixels, stream) {
  for (let t = 0; t < TILES_PER_STREAM; t++) {
    const [x0, y0] = tileOrigin(stream, t);
    for (let y = 0; y < TILE_SIZE; y++)
      for (let x = 0; x < TILE_SIZE; x++) {
        let v = 0;
        for (let p = 0; p < TILE_PLANES; p++)
          v |= ((data[t * TILE_BYTES + p * TILE_SIZE + y] >> (LEFT_PIXEL_BIT - x)) & 1) << p;
        pixels[(y0 + y) * SHEET + x0 + x] = v;
      }
  }
}
export function sheetToStream(pixels, stream) {
  const data = new Uint8Array(STREAM_BYTES);
  for (let t = 0; t < TILES_PER_STREAM; t++) {
    const [x0, y0] = tileOrigin(stream, t);
    for (let y = 0; y < TILE_SIZE; y++)
      for (let x = 0; x < TILE_SIZE; x++) {
        const v = pixels[(y0 + y) * SHEET + x0 + x];
        if (v > PIXEL_MAX) throw new VmFault('tile_pixel_range_required');
        for (let p = 0; p < TILE_PLANES; p++)
          data[t * TILE_BYTES + p * TILE_SIZE + y] |= ((v >> p) & 1) << (LEFT_PIXEL_BIT - x);
      }
  }
  return data;
}

// Windows BMP: file header (14 bytes, "BM", file size at 2, pixel offset at 10),
// BITMAPINFOHEADER (40 bytes: width 18, height 22, planes 26, bits per pixel 28,
// compression 30, image size 34, colours used 46), then the palette (four bytes
// B, G, R, 0 per colour) and the rows, each padded to four bytes.
const BMP_SIGNATURE = [0x42, 0x4d],
  BMP_FILE_HEADER_BYTES = 14,
  BMP_INFO_HEADER_BYTES = 40,
  BMP_FILE_SIZE = 2,
  BMP_PIXEL_OFFSET = 10,
  BMP_INFO_SIZE = 14,
  BMP_WIDTH = 18,
  BMP_HEIGHT = 22,
  BMP_PLANES = 26,
  BMP_BITS_PER_PIXEL = 28,
  BMP_COMPRESSION = 30,
  BMP_IMAGE_SIZE = 34,
  BMP_COLOURS_USED = 46,
  BMP_COLOURS = 256,
  BMP_PALETTE_ENTRY_BYTES = 4,
  BMP_COLOUR_BYTES = 3,
  BMP_ROW_ALIGN = 4,
  INDEXED_BITS = 8,
  // Grey palette for the 16 pixel values, 17 steps each (15 * 17 = 255).
  GREY_LEVELS = 16,
  GREY_STEP = 17;

// Indexed BMP with 8 bits, 256 palette colours (grey 0-15 in 17 steps each), rows from the bottom.
export function writeBmp(pixels, width, height) {
  const paletteStart = BMP_FILE_HEADER_BYTES + BMP_INFO_HEADER_BYTES,
    offset = paletteStart + BMP_COLOURS * BMP_PALETTE_ENTRY_BYTES,
    bytes = new Uint8Array(offset + width * height),
    view = new DataView(bytes.buffer);
  bytes.set(BMP_SIGNATURE);
  view.setUint32(BMP_FILE_SIZE, bytes.length, true);
  view.setUint32(BMP_PIXEL_OFFSET, offset, true);
  view.setUint32(BMP_INFO_SIZE, BMP_INFO_HEADER_BYTES, true);
  view.setInt32(BMP_WIDTH, width, true);
  view.setInt32(BMP_HEIGHT, height, true);
  view.setUint16(BMP_PLANES, 1, true);
  view.setUint16(BMP_BITS_PER_PIXEL, INDEXED_BITS, true);
  view.setUint32(BMP_IMAGE_SIZE, width * height, true);
  view.setUint32(BMP_COLOURS_USED, BMP_COLOURS, true);
  for (let i = 0; i < GREY_LEVELS; i++) {
    const entry = paletteStart + i * BMP_PALETTE_ENTRY_BYTES;
    bytes.fill(i * GREY_STEP, entry, entry + BMP_COLOUR_BYTES);
  }
  for (let y = 0; y < height; y++)
    bytes.set(pixels.subarray(y * width, (y + 1) * width), offset + (height - 1 - y) * width);
  return bytes;
}
export function readBmp(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes[0] !== BMP_SIGNATURE[0] ||
    bytes[1] !== BMP_SIGNATURE[1] ||
    view.getUint16(BMP_BITS_PER_PIXEL, true) !== INDEXED_BITS ||
    view.getUint32(BMP_COMPRESSION, true) !== 0
  )
    throw new VmFault('tile_bmp_format_required');
  const offset = view.getUint32(BMP_PIXEL_OFFSET, true),
    width = view.getInt32(BMP_WIDTH, true),
    rows = view.getInt32(BMP_HEIGHT, true),
    height = Math.abs(rows),
    stride = (width + BMP_ROW_ALIGN - 1) & ~(BMP_ROW_ALIGN - 1);
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    pixels.set(
      bytes.subarray(
        offset + (rows > 0 ? height - 1 - y : y) * stride,
        offset + (rows > 0 ? height - 1 - y : y) * stride + width,
      ),
      y * width,
    );
  return { width, height, pixels };
}

// From the ROM view (read8 at CPU addresses): addresses, data and decompositions.
export function readTiles(read8) {
  const bitsFor = lzBits((n) => read8(0x80a033 + n)),
    streams = [];
  for (let i = 0; i < TILE_STREAMS; i++) {
    const bank = TILE_BANK + (i >> BYTE_BITS),
      start =
        ((bank << WORD_BITS) |
          (read8(TILE_TABLE + 2 * i) | (read8(TILE_TABLE + 2 * i + 1) << BYTE_BITS))) +
        2;
    const found = lzDecode((n) => read8(start + n), STREAM_BYTES, bitsFor);
    streams.push({ start, ...found });
  }
  return streams;
}

// Writes the table and streams from sheets and decompositions to rom; each stream
// must stay at its address and may not overwrite a byte in use.
export function placeTiles(rom, present, { streams }, sheets) {
  const placed = placedReader(rom, present),
    bitsFor = lzBits((n) => placed(0x80a033 + n));
  const put = romWriter(rom, present, 'tile_layout_changed');
  if (streams.length !== TILE_STREAMS) throw new VmFault('tile_streams_required');
  streams.forEach(({ address, tokens }, i) => {
    const start = parseInt(address.replace(':', ''), HEX_RADIX),
      bank = TILE_BANK + (i >> BYTE_BITS),
      pointer = (start - 2) & WORD_MASK;
    if (start >>> WORD_BITS !== bank) throw new VmFault('tile_layout_changed', start);
    put(TILE_TABLE + 2 * i, pointer & BYTE_MASK);
    put(TILE_TABLE + 2 * i + 1, pointer >> BYTE_BITS);
    const parse = tokens.split(' ').map((t) => t.split(':').map(Number));
    const bytes = lzEncode(sheetToStream(sheets[i >> BYTE_BITS], i), parse, bitsFor);
    for (let n = 0; n < bytes.length; n++) put(start + n, bytes[n]);
  });
}
