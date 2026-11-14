// Fixed-slot pixel edits for the shared sources in CHARACTER-STREAM-EDITING.md.
import { VmFault } from '../vm/memory.mjs';
import { lzBits, lzDecode, lzEncode } from './lz.mjs';
import { placedReader, requireRomAddress, romOffset, wordReader } from './rom-bytes.mjs';
import { VRAM_FORMATS, sheetsToCharacters } from './vram-tiles.mjs';
import { BYTE_BITS, HEX_RADIX, WORD_BITS } from '../constants/bits.mjs';
import { TILE_SIZE, PLANE_PAIR_BYTES } from '../constants/ppu.mjs';

export const CHARACTER_EDITS_FILE = 'vm-character-edits.json';
export const CHARACTER_EDITS_FORMAT = 'shadowrun-character-edits-v1';
// Original source identities, formats and character counts from the consumer audit.
const CHARACTER_SOURCES = new Map([
  ['80:FF98', ['bg2', 5]],
  ['81:F8B8', ['bg2', 82]],
  ['81:FC46', ['obj4', 512]],
  ['81:FF08', ['bg4', 2]],
  ['84:DAF2', ['bg4', 213]],
  ['84:F7D5', ['bg2', 67]],
  ['84:F9E8', ['obj4', 192]],
  ['84:FD75', ['bg4', 10]],
  ['84:FE5F', ['bg4', 14]],
  ['85:DFF8', ['bg4', 360]],
  ['85:ECC0', ['obj4', 512]],
  ['85:F8AD', ['bg4', 41]],
  ['85:FC15', ['bg2', 54]],
  ['86:E00A', ['bg4', 303]],
  ['86:FBF6', ['bg4', 57]],
  ['87:D71A', ['obj4', 768]],
  ['87:E6D9', ['bg4', 310]],
  ['87:FB12', ['obj4', 64]],
  ['88:8000', ['obj4', 256]],
  ['88:85D8', ['obj4', 64]],
  ['88:8C43', ['obj4', 64]],
  ['88:929A', ['obj4', 64]],
  ['88:98D6', ['obj4', 64]],
  ['88:9EFC', ['obj4', 64]],
  ['88:A51F', ['obj4', 64]],
  ['88:AB16', ['obj4', 64]],
  ['88:B104', ['obj4', 64]],
  ['88:B6F0', ['obj4', 64]],
  ['88:BCDC', ['obj4', 64]],
  ['88:C2C1', ['obj4', 64]],
  ['88:C89E', ['obj4', 64]],
  ['88:CE71', ['obj4', 64]],
  ['88:D43F', ['obj4', 64]],
  ['88:DA09', ['obj4', 64]],
  ['88:DFBF', ['obj4', 64]],
  ['88:E571', ['obj4', 64]],
  ['88:EB1C', ['obj4', 64]],
  ['88:F0A4', ['obj4', 64]],
  ['88:F628', ['obj4', 64]],
  ['88:FB85', ['obj4', 64]],
  ['89:8000', ['obj4', 64]],
  ['89:8531', ['obj4', 64]],
  ['89:8A4E', ['obj4', 64]],
  ['89:8F60', ['obj4', 64]],
  ['89:9469', ['obj4', 64]],
  ['89:9964', ['obj4', 64]],
  ['89:9E56', ['obj4', 64]],
  ['89:A2D9', ['obj4', 64]],
  ['89:A75C', ['obj4', 64]],
  ['89:ABDB', ['obj4', 64]],
  ['89:B057', ['obj4', 64]],
  ['89:B410', ['obj4', 64]],
  ['89:B7AA', ['obj4', 64]],
  ['89:BB12', ['obj4', 64]],
  ['89:BE70', ['obj4', 64]],
  ['89:CFD8', ['obj4', 512]],
  ['89:ECED', ['bg4', 168]],
  ['8A:8131', ['bg4', 60]],
]);
const LANGUAGE_FONTS = new Set(['81:F8B8', '85:FC15']);
const PIXEL_ROW = /^[0-9A-F]{8}$/;
const fields = (value, allowed) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).every((key) => allowed.includes(key));
const equal = (a, b) => a.length === b.length && a.every((v, n) => v === b[n]);

function changeCharacter(data, character, source) {
  if (!fields(character, ['index', 'pixels'])) throw new VmFault('character_edit_fields_required');
  const { index, pixels } = character;
  if (!Number.isInteger(index) || index < 0 || index >= source.tiles)
    throw new VmFault('character_edit_index_required');
  const bpp = VRAM_FORMATS[source.format];
  if (
    !Array.isArray(pixels) ||
    pixels.length !== TILE_SIZE ||
    pixels.some((row) => typeof row !== 'string' || !PIXEL_ROW.test(row))
  )
    throw new VmFault('character_edit_pixels_required');
  const at = index * bpp * TILE_SIZE;
  data.fill(0, at, at + bpp * TILE_SIZE);
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++) {
      const value = parseInt(pixels[y][x], HEX_RADIX);
      if (value >> bpp) throw new VmFault('character_edit_pixels_required');
      for (let p = 0; p < bpp; p++)
        data[at + (p >> 1) * PLANE_PAIR_BYTES + y * 2 + (p & 1)] |=
          ((value >> p) & 1) << (TILE_SIZE - 1 - x);
    }
}

// Plan against unmodified sources and decoded baseline sheets. Only packed
// prefixes are published; length words, presence marks and old tails stay intact.
export function applyCharacterEdits(rom, present, asset, baseline, sheets) {
  if (
    !fields(asset, ['format', 'edits']) ||
    asset.format !== CHARACTER_EDITS_FORMAT ||
    !Array.isArray(asset.edits)
  )
    throw new VmFault('character_edits_format_required');
  const sources = baseline?.streams?.filter((s) => Object.hasOwn(VRAM_FORMATS, s.format));
  if (
    sources?.length !== CHARACTER_SOURCES.size ||
    new Set(sources.map((s) => s.address)).size !== CHARACTER_SOURCES.size ||
    sources.some((s) => {
      const expected = CHARACTER_SOURCES.get(s.address);
      return !expected || s.format !== expected[0] || s.tiles !== expected[1];
    })
  )
    throw new VmFault('character_edit_baseline_required');
  const identities = new Map(sources.map((s) => [s.address, s]));
  const seen = new Set();
  for (const edit of asset.edits) {
    if (!fields(edit, ['address', 'characters']))
      throw new VmFault('character_edit_fields_required');
    if (LANGUAGE_FONTS.has(edit.address)) throw new VmFault('character_edit_language_font');
    if (!identities.has(edit.address) || seen.has(edit.address))
      throw new VmFault('character_edit_identity_required');
    seen.add(edit.address);
    if (!Array.isArray(edit.characters)) throw new VmFault('character_edit_characters_required');
  }
  if (!asset.edits.length) return;
  const originals = new Map(
    sheetsToCharacters(sources, sheets).map((data, n) => [sources[n], data]),
  );
  const read8 = placedReader(rom, present),
    read16 = wordReader(read8);
  const bitsFor = lzBits((n) => read8(0x80a033 + n));
  const plans = [];
  for (const edit of asset.edits) {
    const source = identities.get(edit.address),
      original = originals.get(source);
    const cpu = requireRomAddress(edit.address, 'character_edit_identity_required');
    const length = read16(cpu);
    if (length !== original.length) throw new VmFault('character_edit_baseline_required', cpu);
    const found = lzDecode((n) => read8(cpu + 2 + n), length, bitsFor);
    const tokens = source.tokens.split(' ').map((t) => t.split(':').map(Number));
    if (!equal(found.data, original) || JSON.stringify(found.tokens) !== JSON.stringify(tokens))
      throw new VmFault('character_edit_baseline_required', cpu);
    const baselinePacked = lzEncode(original, tokens, bitsFor);
    if (
      baselinePacked.length !== found.byteLength ||
      !baselinePacked.every((v, n) => v === read8(cpu + 2 + n))
    )
      throw new VmFault('character_edit_baseline_required', cpu);
    const data = original.slice(),
      indices = new Set();
    for (const character of edit.characters) {
      if (indices.has(character?.index)) throw new VmFault('character_edit_index_required');
      changeCharacter(data, character, source);
      indices.add(character.index);
    }
    const packed = lzEncode(data, tokens, bitsFor);
    if (packed.length > baselinePacked.length)
      throw new VmFault('character_edit_slot_exceeded', cpu);
    const decoded = lzDecode((n) => packed[n], length, bitsFor);
    if (
      !equal(decoded.data, data) ||
      decoded.tokens.reduce((sum, t) => sum + t.at(-1), 0) !== length
    )
      throw new VmFault('character_edit_output_required', cpu);
    // Native unpackers fetch both literal and bit data as words.
    for (const bytes of [baselinePacked, packed]) {
      const bitStart = bytes[0] | (bytes[1] << BYTE_BITS);
      const readLength =
        2 + Math.max(bitStart + 1, bitStart + 2 * Math.ceil((bytes.length - bitStart) / 2));
      if ((cpu + readLength - 1) >>> WORD_BITS !== cpu >>> WORD_BITS)
        throw new VmFault('character_edit_slot_exceeded', cpu);
      for (let n = 0; n < readLength; n++) read8(cpu + n);
    }
    plans.push({ offset: romOffset(cpu) + 2, packed });
  }
  for (const { offset, packed } of plans) rom.set(packed, offset);
}
