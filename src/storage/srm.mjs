// The .srm serializer. File offsets, the original two-slot layout, the optional
// four-slot extension and the checksum belong here. Game state is read and restored
// by owner, field and entry; it has no knowledge of this file layout.
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

export const SRAM_SIZE = 0x2000,
  SRAM_SIZE_FOUR_SLOTS = 0x4000,
  ORIGINAL_SAVE_SLOTS = 2,
  FOUR_SAVE_SLOTS = 4,
  CHECKSUM_WORD_BYTES = 2,
  SLOT_CHECKED_BYTES = 0x0f26,
  SAVED_BYTES = CHECKSUM_WORD_BYTES + SLOT_CHECKED_BYTES,
  SECOND_SUM_START = 0xad,
  CHECKSUM_KEY = 0xaba5;
export const SLOT_OFFSETS_FOUR = Object.freeze([0, 0x0ffe, 0x2000, 0x2ffe]);
const ROOM_OFFSET = 2;
// Global options follow the original two slots even in a four-slot image.
const SETTINGS_OFFSET = 0x1ffc,
  CONTROL_OFFSET = SETTINGS_OFFSET + 1,
  MUSIC_OFFSET = SETTINGS_OFFSET + 2,
  SETTINGS_CHECKSUM_OFFSET = SETTINGS_OFFSET + 3,
  SETTINGS_CHECKSUM_SEED = 0xeb,
  SETTINGS_CHECKSUM_XOR = 0x5a,
  SETTINGS_BYTES = 3;

const settingsViews = new WeakMap();
export function readSaveSettings(sram) {
  let settings = settingsViews.get(sram);
  if (settings) return settings;
  settings = {
    get stereo() {
      return sram[SETTINGS_OFFSET];
    },
    get control() {
      return sram[CONTROL_OFFSET];
    },
    get music() {
      return sram[MUSIC_OFFSET];
    },
    get outputControlWord() {
      return sram[SETTINGS_OFFSET] | (sram[CONTROL_OFFSET] << BYTE_BITS);
    },
    // Existing game consumers still read these complete words during phase 3.
    get musicWord() {
      return sram[MUSIC_OFFSET] | (sram[SETTINGS_CHECKSUM_OFFSET] << BYTE_BITS);
    },
    get controlMusicWord() {
      return sram[CONTROL_OFFSET] | (sram[MUSIC_OFFSET] << BYTE_BITS);
    },
  };
  settingsViews.set(sram, settings);
  return settings;
}
export function writeSaveSettings(sram, { stereo, control, music }) {
  if (stereo !== undefined) sram[SETTINGS_OFFSET] = stereo;
  if (control !== undefined) sram[CONTROL_OFFSET] = control;
  if (music !== undefined) sram[MUSIC_OFFSET] = music;
}
export function settingsChecksum(sram) {
  let sum = SETTINGS_CHECKSUM_SEED,
    carry = 0;
  for (let n = SETTINGS_BYTES - 1; n >= 0; n--) {
    const total = sum + sram[SETTINGS_OFFSET + n] + carry;
    sum = total & BYTE_MASK;
    carry = total >>> BYTE_BITS;
  }
  return sum ^ SETTINGS_CHECKSUM_XOR;
}
export const settingsValid = (sram) => settingsChecksum(sram) === sram[SETTINGS_CHECKSUM_OFFSET];
export function storeSettingsChecksum(sram) {
  sram[SETTINGS_CHECKSUM_OFFSET] = settingsChecksum(sram);
}

// owner, field, file offset, entries, bytes per entry, file stride (when different).
// Actor records and the per-room script scratch words stay in their existing form
// until their consumers are migrated. Odd word positions are intentional.
export const SAVED_FIELDS = Object.freeze(
  [
    ['scene', 'saveHeader', 0x0000, 1, 2],
    ['scene', 'room', ROOM_OFFSET, 1, 2],
    ['scene', 'storyStage', 0x0004, 1, 2],
    ['combat', 'groupIndex', 0x0006, 1, 2],
    ['combat', 'groupObjects', 0x0008, 4, 2],
    ['combat', 'groupNumbers', 0x0010, 4, 2],
    ['combat', 'groupPositions', 0x0018, 4, 2],
    ['scene', 'actorRecords', 0x0020, 0x0dbb, 1],
    ['scene', 'scriptVariables', 0x0ddb, 32, 2],
    ['scene', 'leaderRecord', 0x0e1b, 18, 1],
    ['scene', 'funds', 0x0e2d, 2, 2],
    ['scene', 'karma', 0x0e31, 1, 2],
    ['combat', 'spellScript', 0x0e33, 1, 2],
    ['combat', 'spellName', 0x0e35, 1, 2],
    ['scene', 'leaderFlags', 0x0e37, 3, 1],
    ['combat', 'spellLevelPointer', 0x0e3a, 1, 2],
    ['scene', 'spells', 0x0e3c, 9, 2],
    ['combat', 'armour', 0x0e4e, 13, 2, 8],
    ['combat', 'armourRating', 0x0e50, 13, 1, 8],
    ['combat', 'weapon', 0x0e51, 13, 2, 8],
    ['combat', 'weaponKind', 0x0e53, 13, 1, 8],
    ['combat', 'weaponDamage', 0x0e54, 13, 1, 8],
    ['combat', 'weaponRange', 0x0e55, 13, 1, 8],
    ['combat', 'magic', 0x0eb6, 13, 1],
    ['scene', 'topics', 0x0ec3, 51, 1],
    ['scene', 'topicFlags', 0x0ef6, 50, 1],
  ].map(Object.freeze),
);

const endAroundAdd = (a, b) => {
  let sum = a + b;
  if (sum > BYTE_MASK) sum = (sum + 1) & BYTE_MASK;
  return sum === BYTE_MASK ? 0 : sum;
};
// The two running sums, including the closing bytes used by diagnostic callers.
export function checksumSums(read, start) {
  let first = 0,
    second = SECOND_SUM_START;
  for (let i = start; i < start + SLOT_CHECKED_BYTES; i++) {
    first = endAroundAdd(read(i), first);
    second = endAroundAdd(first, second);
  }
  const low = endAroundAdd(first, second) ^ BYTE_MASK,
    high = endAroundAdd(low, first) ^ BYTE_MASK;
  return { first, low, high, word: (low | (high << BYTE_BITS)) ^ CHECKSUM_KEY };
}
export const slotChecksum = (sram, offset) =>
  checksumSums((i) => sram[i], offset + CHECKSUM_WORD_BYTES).word;

export function slotOffset(slot, four = false) {
  const count = four ? FOUR_SAVE_SLOTS : ORIGINAL_SAVE_SLOTS;
  if (!Number.isInteger(slot) || slot < 0 || slot >= count)
    throw new RangeError('save slot ' + slot);
  return SLOT_OFFSETS_FOUR[slot];
}
function slotBytes(sram, slot, four) {
  const offset = slotOffset(slot, four);
  if (!(sram instanceof Uint8Array) || offset + SAVED_BYTES > sram.length)
    throw new RangeError('save slot image is incomplete');
  return sram.subarray(offset, offset + SAVED_BYTES);
}
export function occupiedSlots(sram) {
  const count = sram?.length >= SRAM_SIZE_FOUR_SLOTS ? FOUR_SAVE_SLOTS : ORIGINAL_SAVE_SLOTS;
  return Array.from({ length: count }, (_, slot) => {
    const offset = SLOT_OFFSETS_FOUR[slot];
    return (
      !!sram &&
      offset + SAVED_BYTES <= sram.length &&
      slotChecksum(sram, offset) === (sram[offset] | (sram[offset + 1] << BYTE_BITS))
    );
  });
}

export function serializeGame(state) {
  const bytes = new Uint8Array(SAVED_BYTES);
  for (const [owner, field, offset, count, width, stride = width] of SAVED_FIELDS)
    for (let i = 0; i < count; i++) {
      const value = state.get(owner, field, i),
        at = offset + i * stride;
      bytes[at] = value & BYTE_MASK;
      if (width === 2) bytes[at + 1] = value >>> BYTE_BITS;
    }
  const checksum = slotChecksum(bytes, 0);
  bytes[0] = checksum & BYTE_MASK;
  bytes[1] = checksum >>> BYTE_BITS;
  return bytes;
}
export function restoreGame(state, bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== SAVED_BYTES)
    throw new RangeError('saved game size is invalid');
  for (const [owner, field, offset, count, width, stride = width] of SAVED_FIELDS)
    for (let i = 0; i < count; i++) {
      const at = offset + i * stride;
      state.set(owner, field, i, bytes[at] | (width === 2 ? bytes[at + 1] << BYTE_BITS : 0));
    }
}
export function writeSaveSlot(sram, slot, state, four = false) {
  const destination = slotBytes(sram, slot, four),
    bytes = serializeGame(state);
  destination.set(bytes);
}
// Loading follows the title's validity check, as in the original game.
export function readSaveSlot(sram, slot, state, four = false) {
  restoreGame(state, slotBytes(sram, slot, four));
}
export function inspectSaveSlot(sram, slot, four = false) {
  const bytes = slotBytes(sram, slot, four),
    sums = checksumSums((i) => bytes[i], CHECKSUM_WORD_BYTES);
  return {
    valid: sums.word === (bytes[0] | (bytes[1] << BYTE_BITS)),
    sums,
    room: bytes[ROOM_OFFSET] | (bytes[ROOM_OFFSET + 1] << BYTE_BITS),
    bytes,
  };
}
