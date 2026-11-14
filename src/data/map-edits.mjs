// Fixed-slot screen-map words; specialized maps retain separate ownership.
import { VmFault } from '../vm/memory.mjs';
import { lzBits, lzDecode, lzEncode } from './lz.mjs';
import { fnv1a } from './fnv.mjs';
import { placedReader, requireRomAddress, romOffset } from './rom-bytes.mjs';
import { BYTE_BITS, BYTE_MASK, HEX_RADIX, WORD_BITS } from '../constants/bits.mjs';

export const MAP_EDITS_FILE = 'vm-map-edits.json';
export const MAP_EDITS_FORMAT = 'shadowrun-map-edits-v1';
// Original European word counts, complete slot bytes and packed FNV checksums.
// Capacities are pinned here, never inferred from editable words or tokens.
const MAP_SOURCES = new Map([
  ['81:F803', [128, 181, 774153539]],
  ['81:FB0A', [960, 316, 2201452486]],
  ['81:FEF0', [1024, 24, 3252882998]],
  ['81:FF40', [928, 63, 1205400981]],
  ['84:D8DD', [1024, 533, 3440552555]],
  ['84:F110', [1024, 220, 768441320]],
  ['84:F1EC', [1024, 22, 1784079447]],
  ['84:F202', [1024, 79, 3589163634]],
  ['84:F251', [1024, 66, 3962108717]],
  ['84:F293', [1024, 387, 1758348059]],
  ['84:F416', [1024, 293, 836231828]],
  ['84:F53B', [1024, 337, 4093961936]],
  ['84:F68C', [1024, 329, 4292032945]],
  ['84:FD2B', [800, 74, 1281215733]],
  ['84:FE1E', [640, 65, 2471545245]],
  ['85:D8B1', [960, 1863, 577401297]],
  ['85:F7D9', [1024, 212, 1595700879]],
  ['85:FD38', [160, 126, 422543403]],
  ['86:DCD7', [1024, 410, 1714139480]],
  ['86:DE71', [1024, 409, 3470389183]],
  ['86:FB31', [640, 197, 1351904881]],
  ['87:E272', [960, 1127, 3301314427]],
  ['89:E14E', [16384, 2557, 2487261208]],
  ['89:EB4B', [1024, 208, 2558250425]],
  ['89:EC1B', [1024, 11, 1961605906]],
  ['89:F7CE', [960, 392, 2926759024]],
  ['8A:879C', [960, 162, 3654595695]],
]);
const LANGUAGE_MAPS = new Set(['81:F803', '81:FB0A', '85:FD38']);
const SPECIALIZED_MAPS = new Set(['81:FF40', '89:E14E', '89:EB4B', '89:EC1B']);
const WORD_HEX = /^[0-9A-F]{4}$/;
const fields = (value, allowed) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).every((key) => allowed.includes(key));
const equal = (a, b) => a.length === b.length && a.every((v, n) => v === b[n]);

function baselineWords(source) {
  if (!Array.isArray(source.words) || source.words.some((line) => typeof line !== 'string'))
    throw new VmFault('map_edit_baseline_required');
  const words = source.words.join(' ').split(/\s+/).filter(Boolean);
  if (words.length !== MAP_SOURCES.get(source.address)?.[0] || words.some((w) => !WORD_HEX.test(w)))
    throw new VmFault('map_edit_baseline_required');
  return Uint8Array.from(
    words.flatMap((w) => {
      const value = parseInt(w, HEX_RADIX);
      return [value & BYTE_MASK, value >>> BYTE_BITS];
    }),
  );
}

// Prepare every prefix before publishing writes. Headers, tails, neighboring
// sources and presence marks remain unchanged, including on a late failure.
export function applyMapEdits(rom, present, asset, baseline) {
  if (
    !fields(asset, ['format', 'edits']) ||
    asset.format !== MAP_EDITS_FORMAT ||
    !Array.isArray(asset.edits)
  )
    throw new VmFault('map_edits_format_required');
  const sources = baseline?.streams?.filter((s) => s.format === 'map');
  if (
    sources?.length !== MAP_SOURCES.size ||
    new Set(sources.map((s) => s.address)).size !== MAP_SOURCES.size
  )
    throw new VmFault('map_edit_baseline_required');
  const originals = new Map(sources.map((s) => [s.address, baselineWords(s)]));
  const identities = new Map(sources.map((s) => [s.address, s]));
  const read8 = placedReader(rom, present);
  const bitsFor = lzBits((n) => read8(0x80a033 + n));
  const seen = new Set(),
    plans = [];
  for (const edit of asset.edits) {
    if (!fields(edit, ['address', 'words'])) throw new VmFault('map_edit_fields_required');
    if (LANGUAGE_MAPS.has(edit.address)) throw new VmFault('map_edit_language_map');
    if (SPECIALIZED_MAPS.has(edit.address)) throw new VmFault('map_edit_specialized_map');
    if (!identities.has(edit.address) || seen.has(edit.address))
      throw new VmFault('map_edit_identity_required');
    seen.add(edit.address);
    if (!Array.isArray(edit.words)) throw new VmFault('map_edit_words_required');
    const source = identities.get(edit.address),
      original = originals.get(edit.address);
    const cpu = requireRomAddress(edit.address, 'map_edit_identity_required');
    const [count, capacity, checksum] = MAP_SOURCES.get(edit.address);
    if ((cpu + capacity - 1) >>> WORD_BITS !== cpu >>> WORD_BITS)
      throw new VmFault('map_edit_baseline_required', cpu);
    const slot = Uint8Array.from({ length: capacity }, (_, n) => read8(cpu + n));
    if (fnv1a(slot) !== checksum || (slot[0] | (slot[1] << BYTE_BITS)) !== original.length)
      throw new VmFault('map_edit_baseline_required', cpu);
    const found = lzDecode((n) => slot[n + 2], original.length, bitsFor);
    if (
      !equal(found.data, original) ||
      found.byteLength + 2 !== capacity ||
      found.tokens.reduce((sum, t) => sum + t.at(-1), 0) !== original.length ||
      found.tokens.map((t) => t.join(':')).join(' ') !== source.tokens
    )
      throw new VmFault('map_edit_baseline_required', cpu);
    const data = original.slice(),
      indices = new Set();
    for (const word of edit.words) {
      if (!fields(word, ['index', 'value'])) throw new VmFault('map_edit_fields_required');
      if (
        !Number.isInteger(word.index) ||
        word.index < 0 ||
        word.index >= count ||
        indices.has(word.index)
      )
        throw new VmFault('map_edit_index_required');
      if (typeof word.value !== 'string' || !WORD_HEX.test(word.value))
        throw new VmFault('map_edit_value_required');
      indices.add(word.index);
      const value = parseInt(word.value, HEX_RADIX);
      data[word.index * 2] = value & BYTE_MASK;
      data[word.index * 2 + 1] = value >>> BYTE_BITS;
    }
    const packed = lzEncode(data, found.tokens, bitsFor);
    if (packed.length + 2 > capacity) throw new VmFault('map_edit_slot_exceeded', cpu);
    const decoded = lzDecode((n) => packed[n], data.length, bitsFor);
    if (
      !equal(decoded.data, data) ||
      decoded.tokens.reduce((sum, t) => sum + t.at(-1), 0) !== data.length
    )
      throw new VmFault('map_edit_output_required', cpu);
    // Both literal and bit refills read words. Margins must already exist;
    // their presence grants no additional packed capacity.
    for (const bytes of [slot.subarray(2), packed]) {
      const bitStart = bytes[0] | (bytes[1] << BYTE_BITS);
      const readLength =
        2 + Math.max(bitStart + 1, bitStart + 2 * Math.ceil((bytes.length - bitStart) / 2));
      if ((cpu + readLength - 1) >>> WORD_BITS !== cpu >>> WORD_BITS)
        throw new VmFault('map_edit_slot_exceeded', cpu);
      for (let n = 0; n < readLength; n++) read8(cpu + n);
    }
    plans.push({ offset: romOffset(cpu) + 2, packed });
  }
  for (const { offset, packed } of plans) rom.set(packed, offset);
}
