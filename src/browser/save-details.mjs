// Browser-only slot descriptions. The original SRAM remains unchanged.
import {
  occupiedSlots,
  SLOT_OFFSETS_FOUR,
  SLOT_CHECKED_BYTES,
  CHECKSUM_WORD_BYTES,
} from '../game/save-slots.mjs';
import { ROOM, SAVE_STATE_START } from '../data/wram.mjs';
import { saveToText } from './save-file.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';

export const SAVE_DETAILS_KEY = 'shadowrun.save-details.1';
const SAVED_BYTES = SLOT_CHECKED_BYTES + CHECKSUM_WORD_BYTES;
// game-start.mjs NEW_GAME_ROOM and tools/mesen/saves/apartment.srm WORD 2.
const MORGUE_ROOM = 3,
  APARTMENT_ROOM = 345;

export function parseSaveDetails(text) {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value.slice(0, SLOT_OFFSETS_FOUR.length) : [];
  } catch {
    return [];
  }
}

// Exact slot bytes bind optional metadata to the save, including after import.
export function describeSaveSlots(sram, details = []) {
  return occupiedSlots(sram).map((valid, slot) => {
    if (!valid) return null;
    const offset = SLOT_OFFSETS_FOUR[slot],
      roomOffset = offset + ROOM - SAVE_STATE_START,
      identity = saveToText(sram.subarray(offset, offset + SAVED_BYTES)),
      detail = details[slot],
      savedAt =
        detail?.identity === identity &&
        typeof detail.savedAt === 'string' &&
        Number.isFinite(Date.parse(detail.savedAt))
          ? detail.savedAt
          : null;
    return { room: sram[roomOffset] | (sram[roomOffset + 1] << BYTE_BITS), identity, savedAt };
  });
}

// Import never manufactures a timestamp. Unchanged slots keep their own date;
// saves from an 8 KiB session are merged before this function is called.
export function updateSaveDetails(previous, next, details, savedAt = null) {
  const before = describeSaveSlots(previous);
  return describeSaveSlots(next, details).map((slot, index) => {
    if (!slot) return null;
    return {
      identity: slot.identity,
      savedAt: savedAt && slot.identity !== before[index]?.identity ? savedAt : slot.savedAt,
    };
  });
}

export function saveRoomName(room, language) {
  // Verified routes: new game enters room 3 (game-start.mjs); the recorded
  // apartment fixture supplies the apartment entry. Other rooms stay explicit.
  if (room === MORGUE_ROOM) return language === 'de' ? 'Leichenhalle' : 'Morgue';
  if (room === APARTMENT_ROOM) return language === 'de' ? 'Jakes Apartment' : 'Jake’s apartment';
  return null;
}
