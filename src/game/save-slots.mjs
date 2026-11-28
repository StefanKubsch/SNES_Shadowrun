// Game-facing save operations. The .srm serializer owns the file format; this
// adapter retains the diagnostic checksum workspace and completed-save notification.
import { writeStateByte } from '../state/objects.mjs';
import { savedGameState } from '../state/saved-game.mjs';
import { fourSaveSlots } from './bugfixes.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
import {
  DP_CHECKSUM_FIRST_SUM,
  DP_CHECKSUM_HIGH,
  DP_CHECKSUM_WORD,
  DP_SAVE_SLOT,
} from '../data/wram.mjs';
import {
  FOUR_SAVE_SLOTS,
  ORIGINAL_SAVE_SLOTS,
  inspectSaveSlot,
  writeSaveSlot,
} from '../storage/srm.mjs';

// Existing callers can keep these imports while format users move to storage/srm.
export {
  SLOT_OFFSETS_FOUR,
  ORIGINAL_SAVE_SLOTS,
  FOUR_SAVE_SLOTS,
  SLOT_CHECKED_BYTES,
  CHECKSUM_WORD_BYTES,
  SECOND_SUM_START,
  CHECKSUM_KEY,
  slotChecksum,
  occupiedSlots,
} from '../storage/srm.mjs';
export const saveSlotCount = (a) => (fourSaveSlots(a) ? FOUR_SAVE_SLOTS : ORIGINAL_SAVE_SLOTS);

export function saveGame(mem, slot, four) {
  writeSaveSlot(mem.sram, slot, savedGameState(mem), four);
  // Presentation observers also need completed saves whose bytes did not change.
  mem.onSaveSlot?.(slot);
}

export function saveSlotValid(mem, slot, four) {
  const { wram } = mem,
    { valid, sums } = inspectSaveSlot(mem.sram, slot, four);
  writeStateByte(wram, DP_SAVE_SLOT, slot & BYTE_MASK);
  writeStateByte(wram, DP_SAVE_SLOT + 1, (slot >>> BYTE_BITS) & BYTE_MASK);
  writeStateByte(wram, DP_CHECKSUM_FIRST_SUM, sums.first);
  writeStateByte(wram, DP_CHECKSUM_WORD, sums.low);
  writeStateByte(wram, DP_CHECKSUM_HIGH, sums.high);
  return valid;
}
