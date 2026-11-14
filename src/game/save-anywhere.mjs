// Save anywhere (quality-of-life option, docs/SAVING.md): the page asks the
// game to save into a slot outside the bed menu. The save is the same as
// "Save game 1/2" at a bed (81:B17D, lifted as saveGame in
// src/game/save-slots.mjs): it copies 7E:2DE0..3D07 into the SRAM slot from the
// table 81:B124 and writes the slot checksum. Loading therefore works through the
// unchanged title menu ("Resume game n") and the .srm format stays the same. It
// runs at a pad read, never in the middle of a routine, and changes nothing but
// the SRAM slot.
import { SCENE_REQUEST, TIMER } from '../task/wram.mjs';
import { FOUR_SAVE_SLOTS, saveGame, saveSlotCount } from './save-slots.mjs';
import { BYTE_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// Slots 3/4 only with the four-slot option (src/game/save-slots.mjs).
export const SAVE_SLOT_EVENTS = Object.freeze([
  'save-slot-1',
  'save-slot-2',
  'save-slot-3',
  'save-slot-4',
]);
const NO_SCENE_REQUEST = WORD_MASK;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);

// Same moments as the debug room shortcut (src/browser/debug-room.mjs): the
// player control 80:E014 ran in the last picture (no menu, dialogue, glove
// choice, matrix or sequence), no scene change is pending (1CE9 = FFFF), and,
// as in the bed menu 80:CDD6, no countdown runs (1D89 negative; otherwise
// the bed shows its refusal notice 7058).
export function saveAnywhereReachable(game) {
  const wram = game.memory.wram;
  return (
    game.controlNmi >= 0 &&
    game.nmis - game.controlNmi <= 1 &&
    !game.choosing &&
    word(wram, SCENE_REQUEST) === NO_SCENE_REQUEST &&
    (word(wram, TIMER) & WORD_SIGN) !== 0
  );
}

// slot: 0 for "Save game 1", 1 for "Save game 2" and so on.
export function saveToSlot(game, slot) {
  const count = saveSlotCount({ vm: game.vm });
  if (!Number.isInteger(slot) || slot < 0 || slot >= count)
    throw new RangeError('save slot ' + slot);
  saveGame(game.memory, slot, count === FOUR_SAVE_SLOTS);
}
