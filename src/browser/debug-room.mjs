// Debug room shortcut (docs/TCRF-NOTES.md): the matchbox handler (script $126) unlocks its
// "Open" action at the end of a hidden lamppost sequence. "Open" saves the current room entry
// 7E:2DE2 in script word $1A (7E:3BD5, table 7E:3BBB) and calls native $56 (80:CC97) with
// room entry $D2: 2DE2 = D2 and 1CE9 = 7FFF, which the main loop at 80:CC4B takes as a scene
// change to entry 2DE2. The invisible exit there (script $2F9) returns to the saved entry.
// The shortcut performs the same writes, but only while the player controls Jake freely: the
// player control 80:E014 ran in the last picture (no menu, dialogue or glove choice open,
// which "Open" closes with native $80 first) and no scene change is pending (1CE9 = FFFF).
import { ROOM, SCENE_REQUEST, SCRIPT_VARIABLES } from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';

export const DEBUG_ROOM_EVENT = 'debug-room-warp',
  DEBUG_ROOM_ENTRY = 0xd2;
// SCENE_REQUEST values: no change pending, or a change of the room only.
const NO_SCENE_REQUEST = 0xffff,
  ROOM_ONLY = 0x7fff;
// Script words by byte offset: $18 unlocks "Open" (FFFF), $1A saves the room entry.
const OPEN_UNLOCK = SCRIPT_VARIABLES + 0x18,
  SAVED_ROOM = SCRIPT_VARIABLES + 0x1a,
  UNLOCKED = 0xffff;
const readWord = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const writeWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = value >>> BYTE_BITS;
};
export function debugRoomReachable(game) {
  const wram = game.memory.wram;
  return (
    game.controlNmi >= 0 &&
    game.nmis - game.controlNmi <= 1 &&
    !game.choosing &&
    readWord(wram, SCENE_REQUEST) === NO_SCENE_REQUEST
  );
}
export function warpToDebugRoom(wram) {
  writeWord(wram, SAVED_ROOM, readWord(wram, ROOM));
  writeWord(wram, ROOM, DEBUG_ROOM_ENTRY);
  writeWord(wram, SCENE_REQUEST, ROOM_ONLY);
}
// Recordings from the first version of the button (2026-11-01) hold 'debug-room': it only
// unlocked the matchbox's "Open" action, as the PAR code 7E3BD3FF 7E3BD4FF does.
export const DEBUG_ROOM_UNLOCK_EVENT = 'debug-room';
export function unlockDebugRoom(wram) {
  writeWord(wram, OPEN_UNLOCK, UNLOCKED);
}
