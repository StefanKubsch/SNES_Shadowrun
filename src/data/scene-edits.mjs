// Fixed-slot scene backdrops; shapes, objects and room links retain their owners.
import { VmFault } from '../vm/memory.mjs';
import { lzBits, lzDecode, lzEncode } from './lz.mjs';
import { encodeScene } from './scenes.mjs';
import { readSceneTable } from './lz-streams.mjs';
import { COLOUR_MASK } from '../constants/ppu.mjs';
import { fnv1a } from './fnv.mjs';
import { placedReader, requireRomAddress, romOffset } from './rom-bytes.mjs';
import { BYTE_BITS, BYTE_MASK, HEX_RADIX, WORD_BITS } from '../constants/bits.mjs';

export const SCENE_EDITS_FILE = 'vm-scene-edits.json';
export const SCENE_EDITS_FORMAT = 'shadowrun-scene-edits-v1';
// Original European decoded byte counts, complete slots and packed FNV checksums.
// Capacities are pinned here, never inferred from editable records or tokens.
const SCENE_SOURCES = new Map([
  ['8B:D9DC', [301, 191, 3699437445]],
  ['8B:D0BB', [336, 231, 4133072626]],
  ['8B:D5CC', [326, 212, 1176732817]],
  ['8B:CD0A', [346, 226, 2153191651]],
  ['8B:D35D', [331, 215, 2180050650]],
  ['8B:D6A0', [321, 212, 2113586770]],
  ['8B:E465', [225, 175, 2345724086]],
  ['8B:D4FF', [326, 205, 2384724068]],
  ['8B:B536', [500, 396, 3701755124]],
  ['8A:CB78', [1084, 806, 4013464367]],
  ['8A:F61A', [715, 529, 3658017229]],
  ['8B:E029', [256, 202, 62628845]],
  ['8A:E238', [871, 559, 2439446140]],
  ['8B:ED76', [166, 135, 2550296607]],
  ['8B:F97F', [56, 55, 195233404]],
  ['8B:E93D', [196, 133, 3189306336]],
  ['8B:839E', [687, 409, 4275038622]],
  ['8B:A83D', [557, 333, 1545567041]],
  ['8B:9626', [624, 360, 249204420]],
  ['8B:B272', [531, 351, 805442457]],
  ['8B:C63F', [386, 283, 2850055070]],
  ['8B:F46A', [105, 81, 234257594]],
  ['8B:DB66', [281, 196, 3049494103]],
  ['8B:DDDB', [271, 186, 2325223440]],
  ['8B:DF62', [261, 199, 2703263929]],
  ['8B:CFD1', [336, 234, 1693377503]],
  ['8B:9DCC', [600, 460, 2833406345]],
  ['8B:F410', [106, 90, 1744002185]],
  ['8B:CBFD', [351, 269, 365739285]],
  ['8B:AE1C', [541, 409, 2555156935]],
  ['8B:991C', [621, 448, 2990591742]],
  ['8B:AFB5', [539, 362, 525464216]],
  ['8B:BBBB', [471, 279, 167826338]],
  ['8A:E467', [855, 614, 658525500]],
  ['8B:AB25', [545, 376, 1523333539]],
  ['8B:81A3', [688, 507, 854534917]],
  ['8B:A555', [576, 381, 3754287887]],
  ['8B:B11F', [536, 339, 1390834039]],
  ['8B:C0AC', [446, 314, 4213150239]],
  ['8B:8DB3', [641, 473, 2029562481]],
  ['8B:F30D', [121, 91, 1634338842]],
  ['8B:F015', [146, 123, 1638277139]],
  ['8B:E270', [236, 176, 1001369219]],
  ['8A:EED8', [751, 489, 2381636039]],
  ['81:FFE2', [11, 16, 578942502]],
  ['8B:A98A', [550, 411, 3568147379]],
  ['8B:F5F3', [101, 89, 3843337236]],
  ['8B:F64C', [96, 80, 41353646]],
  ['8B:D269', [331, 244, 2760062755]],
  ['8B:8537', [676, 444, 1564362777]],
  ['8B:F0F3', [141, 127, 3351658959]],
  ['8B:9ADC', [611, 378, 2115644050]],
  ['8A:EAA2', [826, 535, 3806745463]],
  ['8B:BE01', [455, 324, 2763492617]],
  ['8B:EC69', [175, 144, 4205220917]],
  ['8B:AC9D', [541, 383, 35203199]],
  ['8A:F82B', [705, 467, 3906896352]],
  ['8A:CE9E', [1050, 733, 3109695128]],
  ['8B:B955', [486, 296, 1353493841]],
  ['8B:F73C', [91, 78, 3594142305]],
  ['8B:CAEC', [351, 273, 2519830926]],
  ['8B:DD09', [271, 210, 267982905]],
  ['8B:F9B6', [41, 45, 3584796122]],
  ['8B:E1BA', [241, 182, 1907252227]],
  ['8B:92CC', [630, 462, 2696059234]],
  ['8B:CED5', [341, 252, 2369876109]],
  ['8B:E514', [221, 172, 1421031705]],
  ['8B:D83D', [316, 217, 354750473]],
  ['8B:E3CA', [226, 155, 1063702778]],
  ['8B:F1E8', [126, 92, 1004806292]],
  ['8A:C7B2', [1346, 966, 3103940722]],
  ['8A:D8A6', [991, 666, 2073216527]],
  ['8B:8000', [691, 419, 4086902165]],
  ['8A:FDAB', [691, 432, 3598080096]],
  ['8B:9143', [636, 393, 3209474305]],
  ['8B:949A', [626, 396, 2610334101]],
  ['8B:978E', [621, 398, 340798700]],
  ['8B:EDFD', [161, 109, 1887290531]],
  ['8A:F479', [721, 417, 421926148]],
  ['8B:F5A5', [101, 78, 1635492552]],
  ['8B:F559', [101, 76, 1787057359]],
  ['8B:BA7D', [471, 318, 490761847]],
  ['8B:88B1', [661, 447, 733259116]],
  ['8A:E8BB', [836, 487, 10400160]],
  ['8B:F2AB', [121, 98, 3580201778]],
  ['8B:F3BF', [106, 81, 3654603242]],
  ['8B:BF45', [446, 359, 1079253757]],
  ['8B:F867', [86, 75, 914980246]],
  ['8B:F78A', [89, 77, 652595096]],
  ['8B:F821', [86, 70, 110841351]],
  ['8B:F50D', [101, 76, 793748853]],
  ['8B:F7D7', [86, 74, 2049715766]],
  ['8B:EE6A', [156, 102, 1749004914]],
  ['8B:E8B7', [196, 134, 4051332028]],
  ['8B:E5C0', [219, 182, 3014743586]],
  ['8B:F6EC', [91, 80, 1978413036]],
  ['8B:E826', [196, 145, 402354204]],
  ['8B:F69C', [91, 80, 1726708436]],
  ['8B:ECF9', [166, 125, 2316723722]],
  ['8B:DC2A', [271, 223, 1819966995]],
  ['8B:E0F3', [246, 199, 3714121735]],
  ['8B:DE95', [263, 205, 2431766703]],
  ['8A:F9FE', [700, 499, 1764510363]],
  ['8A:F286', [728, 499, 2469409465]],
  ['8B:B3D1', [516, 357, 636691641]],
  ['8B:EA40', [186, 152, 3292839818]],
  ['8B:F172', [131, 118, 1556496508]],
  ['8B:F244', [121, 103, 975133362]],
  ['8B:EBDC', [176, 141, 3732156811]],
  ['8B:EF3A', [151, 119, 1674378445]],
  ['8B:F8B2', [81, 79, 576407750]],
  ['8B:F901', [71, 66, 4008668568]],
  ['8B:A3F1', [586, 356, 445521930]],
  ['8B:B6C2', [496, 330, 2096331695]],
  ['8B:F943', [56, 60, 2302369103]],
  ['8B:B80C', [486, 329, 3006764175]],
  ['8B:A119', [591, 350, 3772350233]],
  ['8B:9C56', [601, 374, 1230512171]],
  ['8B:C30F', [436, 271, 3369712457]],
  ['8B:8F8C', [636, 439, 3340041923]],
  ['8B:F090', [141, 99, 1813679442]],
  ['8B:F4BB', [101, 82, 2549354584]],
  ['8B:EFB1', [146, 100, 1056885636]],
  ['8B:C923', [361, 249, 1741562297]],
  ['8B:C531', [416, 270, 3705358907]],
  ['8B:E320', [231, 170, 2021282251]],
  ['8A:ECB9', [821, 543, 2401123576]],
  ['8A:DB40', [986, 624, 2934129598]],
  ['8B:C83D', [361, 230, 4055065531]],
  ['89:FCDD', [1211, 800, 976705444]],
  ['89:F956', [1446, 903, 2310600409]],
  ['8A:D614', [1001, 658, 1261460892]],
  ['8B:E796', [211, 144, 4007353172]],
  ['8B:EED0', [151, 106, 2237431569]],
  ['8A:FF5B', [231, 160, 3285433230]],
  ['8B:E9C2', [186, 126, 1871914947]],
  ['8B:D434', [326, 203, 994721420]],
  ['8B:EB5A', [176, 130, 163160475]],
  ['8B:F368', [111, 87, 3572121425]],
  ['8B:A6D2', [561, 363, 872297733]],
  ['8B:8C0D', [641, 422, 3689423710]],
  ['8B:DA9B', [291, 203, 3223069838]],
  ['8B:8A70', [641, 413, 2043899927]],
  ['8B:C41E', [421, 275, 1222887630]],
  ['8A:E022', [911, 534, 769111519]],
  ['8A:E6CD', [836, 494, 3381513528]],
  ['8A:D3C7', [1001, 589, 149411898]],
  ['8A:D17B', [1001, 588, 2601291368]],
  ['8A:DDB0', [941, 626, 3131250282]],
  ['8A:FBF1', [696, 442, 1980540797]],
  ['8B:CDEC', [341, 233, 126836611]],
  ['8B:C1E6', [441, 297, 2616801934]],
  ['8B:C75A', [371, 227, 1619119374]],
  ['8B:E709', [211, 141, 3810241876]],
  ['8B:CA1C', [356, 208, 1794804528]],
  ['8B:EAD8', [176, 130, 751267787]],
  ['8B:E676', [216, 147, 3925638795]],
  ['8B:D774', [316, 201, 836351603]],
  ['8B:D916', [306, 198, 2282572159]],
  ['8B:A277', [586, 378, 3903519649]],
  ['8B:BCD2', [456, 303, 4162309304]],
  ['8B:9F98', [596, 385, 1066787251]],
  ['8B:86F3', [671, 446, 4160984444]],
  ['8A:F0C1', [731, 453, 886080243]],
  ['8B:D1A2', [331, 199, 3944044964]],
]);
const WORD_HEX = /^[0-9A-F]{4}$/;
const fields = (value, allowed) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).every((key) => allowed.includes(key));
const equal = (a, b) => a.length === b.length && a.every((v, n) => v === b[n]);

// Prepare every prefix before publishing writes. Headers, tails, neighboring
// sources and presence marks remain unchanged, including on a late failure.
export function applySceneEdits(rom, present, asset, baseline, scenes) {
  if (
    !fields(asset, ['format', 'edits']) ||
    asset.format !== SCENE_EDITS_FORMAT ||
    !Array.isArray(asset.edits)
  )
    throw new VmFault('scene_edits_format_required');
  const sources = baseline?.streams?.filter((s) => s.format === 'scene');
  if (
    sources?.length !== SCENE_SOURCES.size ||
    new Set(sources.map((s) => s.address)).size !== SCENE_SOURCES.size ||
    sources.some((s) => !SCENE_SOURCES.has(s.address))
  )
    throw new VmFault('scene_edit_baseline_required');
  if (
    scenes?.scenes?.length !== SCENE_SOURCES.size ||
    scenes.scenes.some((s, n) => s.address !== [...SCENE_SOURCES.keys()][n])
  )
    throw new VmFault('scene_edit_baseline_required');
  const originals = new Map(scenes.scenes.map((s) => [s.address, encodeScene(s)]));
  const identities = new Map(sources.map((s) => [s.address, s]));
  const read8 = placedReader(rom, present);
  if (readSceneTable(read8).some((cpu, n) => cpu !== requireRomAddress(scenes.scenes[n].address)))
    throw new VmFault('scene_edit_baseline_required');
  const bitsFor = lzBits((n) => read8(0x80a033 + n));
  const seen = new Set(),
    plans = [];
  for (const edit of asset.edits) {
    if (!fields(edit, ['address', 'backdrop'])) throw new VmFault('scene_edit_fields_required');
    if (!identities.has(edit.address) || seen.has(edit.address))
      throw new VmFault('scene_edit_identity_required');
    seen.add(edit.address);
    if (
      typeof edit.backdrop !== 'string' ||
      !WORD_HEX.test(edit.backdrop) ||
      parseInt(edit.backdrop, HEX_RADIX) > COLOUR_MASK
    )
      throw new VmFault('scene_edit_value_required');
    const source = identities.get(edit.address),
      original = originals.get(edit.address);
    const cpu = requireRomAddress(edit.address, 'scene_edit_identity_required');
    const [length, capacity, checksum] = SCENE_SOURCES.get(edit.address);
    if ((cpu + capacity - 1) >>> WORD_BITS !== cpu >>> WORD_BITS)
      throw new VmFault('scene_edit_baseline_required', cpu);
    const slot = Uint8Array.from({ length: capacity }, (_, n) => read8(cpu + n));
    if (
      original.length !== length ||
      fnv1a(slot) !== checksum ||
      (slot[0] | (slot[1] << BYTE_BITS)) !== original.length
    )
      throw new VmFault('scene_edit_baseline_required', cpu);
    const found = lzDecode((n) => slot[n + 2], original.length, bitsFor);
    if (
      !equal(found.data, original) ||
      found.byteLength + 2 !== capacity ||
      found.tokens.reduce((sum, t) => sum + t.at(-1), 0) !== original.length ||
      found.tokens.map((t) => t.join(':')).join(' ') !== source.tokens
    )
      throw new VmFault('scene_edit_baseline_required', cpu);
    const data = original.slice();
    const value = parseInt(edit.backdrop, HEX_RADIX);
    data[0] = value & BYTE_MASK;
    data[1] = value >>> BYTE_BITS;
    const packed = lzEncode(data, found.tokens, bitsFor);
    if (packed.length + 2 > capacity) throw new VmFault('scene_edit_slot_exceeded', cpu);
    const decoded = lzDecode((n) => packed[n], data.length, bitsFor);
    if (
      !equal(decoded.data, data) ||
      decoded.tokens.reduce((sum, t) => sum + t.at(-1), 0) !== data.length
    )
      throw new VmFault('scene_edit_output_required', cpu);
    // Both literal and bit refills read words. Margins must already exist;
    // their presence grants no additional packed capacity.
    for (const bytes of [slot.subarray(2), packed]) {
      const bitStart = bytes[0] | (bytes[1] << BYTE_BITS);
      const readLength =
        2 + Math.max(bitStart + 1, bitStart + 2 * Math.ceil((bytes.length - bitStart) / 2));
      if ((cpu + readLength - 1) >>> WORD_BITS !== cpu >>> WORD_BITS)
        throw new VmFault('scene_edit_slot_exceeded', cpu);
      for (let n = 0; n < readLength; n++) read8(cpu + n);
    }
    plans.push({ offset: romOffset(cpu) + 2, packed });
  }
  for (const { offset, packed } of plans) rom.set(packed, offset);
}
