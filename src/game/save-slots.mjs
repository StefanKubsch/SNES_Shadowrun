// Four save slots (quality-of-life option fourSaveSlots, docs/SAVING.md).
// The original slot table 81:B124 already lists four offsets (0, 0FFE, 1FFC,
// 2FFA), but only two slots fit into the 8 KiB SRAM: a third at 1FFC would
// overwrite the option bytes 70:1FFC..1FFF (stereo, control type, music and
// their checksum, 81:D5D0). With the option the SRAM has 16 KiB and slots 3
// and 4 lie behind the original 8 KiB, so the first 8 KiB stay an original
// .srm file. Slots 1 and 2 keep the table values.
import { fourSaveSlots } from './bugfixes.mjs';
import { BYTE_BITS, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import { SRAM_FIRST_BANK } from '../constants/memory-map.mjs';
import { SAVE_STATE_START } from '../task/wram.mjs';
import { SRAM_SIZE_FOUR_SLOTS } from '../vm/memory.mjs';

export const SLOT_OFFSETS_FOUR = Object.freeze([0, 0x0ffe, 0x2000, 0x2ffe]);
export const ORIGINAL_SAVE_SLOTS = 2,
  FOUR_SAVE_SLOTS = SLOT_OFFSETS_FOUR.length;
export const saveSlotCount = (a) => (fourSaveSlots(a) ? FOUR_SAVE_SLOTS : ORIGINAL_SAVE_SLOTS);

// Slot occupancy as the title menu sees it (80:E3DA calls 81:B1AB per slot
// and disables the row when the comparison fails): 81:B12C sums the 0F26
// bytes behind the slot's checksum word with two running 8-bit sums (start 00
// and AD), each with the end-around carry of 81:B174 (a carry adds one, FF
// becomes 00). The result word is the two closing sums EOR ABA5; B1AB
// compares it with the word at the slot offset. Port of
// src/task/native-main-menu.mjs runSaveChecksum, for the page only.
const SLOT_CHECKED_BYTES = 0x0f26,
  CHECKSUM_WORD_BYTES = 2,
  SECOND_SUM_START = 0xad,
  CHECKSUM_KEY = 0xaba5,
  SUM_LIMIT = 0xff;
export { SLOT_CHECKED_BYTES, CHECKSUM_WORD_BYTES, SECOND_SUM_START, CHECKSUM_KEY };
const endAroundAdd = (a, b) => {
  let sum = a + b;
  if (sum > SUM_LIMIT) sum = (sum + 1) & SUM_LIMIT;
  return sum === SUM_LIMIT ? 0 : sum;
};
export function slotChecksum(sram, offset) {
  let first = 0,
    second = SECOND_SUM_START;
  const start = offset + CHECKSUM_WORD_BYTES;
  for (let i = start; i < start + SLOT_CHECKED_BYTES; i++) {
    first = endAroundAdd(sram[i], first);
    second = endAroundAdd(first, second);
  }
  const low = endAroundAdd(first, second) ^ SUM_LIMIT,
    high = endAroundAdd(low, first) ^ SUM_LIMIT;
  return (low | (high << BYTE_BITS)) ^ CHECKSUM_KEY;
}
// Occupied slots of an SRAM image: two for 8 KiB, four for 16 KiB (slots 3/4
// lie behind the original 8 KiB and do not exist in a smaller image).
export function occupiedSlots(sram) {
  const count = sram?.length >= SRAM_SIZE_FOUR_SLOTS ? FOUR_SAVE_SLOTS : ORIGINAL_SAVE_SLOTS;
  return SLOT_OFFSETS_FOUR.slice(0, count).map(
    (offset) =>
      !!sram && slotChecksum(sram, offset) === (sram[offset] | (sram[offset + 1] << BYTE_BITS)),
  );
}

// Save the game (lifted from 81:B17D with 81:B11A and 81:B12C; register-level version
// in src/task/native-main-menu.mjs): the game state 7E:2DE0-3D07 is copied to the
// slot's SRAM offset, and the checksum of the bytes after its first word replaces that
// word. The offset comes from the slot table 81:B124 (four offsets, of which the
// original 8 KiB holds two); with the four-slot option slots 3 and 4 take their own
// offsets behind the original 8 KiB. four: the option is on.
const SLOT_TABLE = 0x81b124,
  SAVED_BYTES = CHECKSUM_WORD_BYTES + SLOT_CHECKED_BYTES,
  SRAM_BASE = SRAM_FIRST_BANK << WORD_BITS;
export function saveGame(mem, slot, four) {
  const offset =
      four && slot >= ORIGINAL_SAVE_SLOTS && slot < FOUR_SAVE_SLOTS
        ? SLOT_OFFSETS_FOUR[slot]
        : mem.read16(SLOT_TABLE + ((slot << 1) & WORD_MASK)),
    { wram } = mem;
  for (let i = 0; i < SAVED_BYTES; i++)
    mem.write8(SRAM_BASE + ((offset + i) & WORD_MASK), wram[SAVE_STATE_START + i]);
  // The saved bytes are the state's: their checksum is that of the state after its
  // first word.
  mem.write16(SRAM_BASE + offset, slotChecksum(wram, SAVE_STATE_START));
}
