// Pixel edits retain the original room tile pointers, output sizes and source
// slots. The extracted tiles remain the baseline; edits never supply packing.
import { VmFault } from '../vm/memory.mjs';
import { lzBits, lzDecode, lzEncode } from './lz.mjs';
import { placedReader, requireRomAddress, romOffset } from './rom-bytes.mjs';
import { STREAM_BYTES, TILE_STREAMS } from './tiles.mjs';
import { BYTE_BITS, HEX_RADIX, WORD_BITS } from '../constants/bits.mjs';
import { TILE_SIZE } from '../constants/ppu.mjs';

export const ROOM_TILE_EDITS_FILE = 'vm-room-tile-edits.json';
export const ROOM_TILE_EDITS_FORMAT = 'shadowrun-room-tile-edits-v1';
const PLANES = 4,
  TILES_PER_STREAM = 4,
  TILE_BYTES = PLANES * TILE_SIZE,
  ROW_PIXELS = TILES_PER_STREAM * TILE_SIZE;
const PIXEL_ROW = new RegExp(`^[0-9A-F]{${ROW_PIXELS}}$`);

// Eight rows of 32 indices: four 8x8 tiles side by side, in stream order.
function encodePixels(pixels) {
  if (
    !Array.isArray(pixels) ||
    pixels.length !== TILE_SIZE ||
    pixels.some((row) => typeof row !== 'string' || !PIXEL_ROW.test(row))
  )
    throw new VmFault('room_tile_edit_pixels_required');
  const bytes = new Uint8Array(STREAM_BYTES);
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < ROW_PIXELS; x++) {
      const value = parseInt(pixels[y][x], HEX_RADIX);
      const tile = Math.floor(x / TILE_SIZE);
      for (let plane = 0; plane < PLANES; plane++)
        bytes[tile * TILE_BYTES + plane * TILE_SIZE + y] |=
          ((value >> plane) & 1) << (TILE_SIZE - 1 - (x % TILE_SIZE));
    }
  return bytes;
}

// Validate the entire set against the still-unmodified cartridge before any
// write. Shorter sources replace only their prefix; the original tail remains.
export function applyRoomTileEdits(rom, present, asset, baseline) {
  if (asset?.format !== ROOM_TILE_EDITS_FORMAT || !Array.isArray(asset.edits))
    throw new VmFault('room_tile_edits_format_required');
  if (baseline?.streams?.length !== TILE_STREAMS)
    throw new VmFault('room_tile_edit_baseline_required');
  const identities = new Map(baseline.streams.map((stream) => [stream.address, stream]));
  if (identities.size !== TILE_STREAMS) throw new VmFault('room_tile_edit_baseline_required');
  const seen = new Set(),
    plans = [];
  const read8 = placedReader(rom, present);
  const bitsFor = lzBits((n) => read8(0x80a033 + n));
  for (const edit of asset.edits) {
    const original = identities.get(edit?.address);
    if (!original || seen.has(edit.address)) throw new VmFault('room_tile_edit_identity_required');
    seen.add(edit.address);
    if (Object.keys(edit).some((key) => key !== 'address' && key !== 'pixels'))
      throw new VmFault('room_tile_edit_fields_required');
    const cpu = requireRomAddress(edit.address, 'room_tile_edit_identity_required');
    const source = lzDecode((n) => read8(cpu + n), STREAM_BYTES, bitsFor);
    const originalTokens = original.tokens.split(' ').map((token) => token.split(':').map(Number));
    if (JSON.stringify(source.tokens) !== JSON.stringify(originalTokens))
      throw new VmFault('room_tile_edit_baseline_required', cpu);
    const data = encodePixels(edit.pixels);
    const packed = lzEncode(data, originalTokens, bitsFor);
    if (packed.length > source.byteLength) throw new VmFault('room_tile_edit_slot_exceeded', cpu);
    const decoded = lzDecode((n) => packed[n], STREAM_BYTES, bitsFor);
    const output = decoded.tokens.reduce((total, token) => total + token.at(-1), 0);
    if (output !== STREAM_BYTES || decoded.data.some((value, n) => value !== data[n]))
      throw new VmFault('room_tile_edit_output_required', cpu);
    const bitStart = packed[0] | (packed[1] << BYTE_BITS);
    const readLength = bitStart + 2 * Math.ceil((packed.length - bitStart) / 2);
    if ((cpu + readLength - 1) >>> WORD_BITS !== cpu >>> WORD_BITS)
      throw new VmFault('room_tile_edit_slot_exceeded', cpu);
    for (let n = 0; n < Math.max(readLength, source.byteLength); n++) read8(cpu + n);
    plans.push({ offset: romOffset(cpu), packed });
  }
  for (const { offset, packed } of plans) rom.set(packed, offset);
}
