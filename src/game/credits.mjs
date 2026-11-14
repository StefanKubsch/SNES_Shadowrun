// Credits from the start menu (quality-of-life option, fourth in-game menu row):
// the staff credits that the game otherwise plays only at its end.
//
// The start menu 81:E14A waits for input in 81:E29F. In the original, that
// loop counts DP 1C down and, at zero, leaves with 0E = FFFF; E14A then
// returns FFFE and the frontend loop 80:A18C plays the attract game 80:A168
// before it shows the start menu again. Selecting the fourth row uses the
// same outer exit, and A18C calls the credits instead of the attract game:
// legacy recorded requests still leave at the next E29F waiting round.
// the sequence 81:CDF8 with A = 5 and X = 0, as the ending's native 54
// (80:CC33) requests it through 1CE9/1CEB. Afterwards A18C shows the start menu
// again (call at 80:A1D6).
//
// Ending them is a port addition: CDF8 checks 01CA & 9000 (B or Start) after
// each round, but for sequence 5 the animation 81:D1F0 clears 01CA first
// (STZ $01CA, ROM bytes 9C CA 01), so the ending's credits cannot be skipped
// in the original. While the menu's credits run, CDF8 keeps the pad word of
// its read at F298 for that check (src/task/main-scene.mjs).
//
// Music is a port addition as well. CDF8 starts no music for sequence 5 (its
// entry in the music table 81:D3BF is FFFF, its sound set entry 81:D3CB is 0),
// so the ending's credits keep the music of the room the ending plays in:
// room 5 (table entries 8 and 1C, scene 86). Its actor 578 has script 199,
// which script F8 replaces with 19A; 19A chooses script 156, which calls
// native 54 with sequence 5 (the credits) and room 3 afterwards. The start menu
// plays no music (7E:1CDE = FFFF) and holds the title's sound directory 3, so
// the menu's credits were silent. They now set up the game's sounds as the
// attract game does (81:EF63, directory 0), start that room's music through
// 81:EF47 as the room loader 80:A4BF does, and afterwards stop it (81:EF94,
// 1CDE = FFFF) and load the title's directory again (F229 with 0, F092 with 3),
// as the attract game does before the start menu returns. Starting the music
// on the title's directory played nothing and later read the I/O page.
import { PAD_HELD, MUSIC } from '../task/wram.mjs';
import { roomHeader, ROOM_HEADER_MUSIC } from '../data/rooms.mjs';
import { BYTE_BITS, WORD_MASK } from '../constants/bits.mjs';

// The state lives on the script interpreter, so a recording replays it from
// its event (src/browser/recording.mjs).
export const CREDITS_EVENT = 'credits',
  CREDITS_SEQUENCE = 5,
  CREDITS_ARGUMENT = 0;

// E29F marks each waiting round; any exit clears the mark.
export function markStartMenu(vm, waiting) {
  if (vm) vm.startMenuWaiting = waiting;
}
export const startMenuWaiting = (game) => game.vm.startMenuWaiting === true;
export function requestCredits(vm) {
  vm.creditsRequested = true;
}
export const creditsRequested = (vm) => vm?.creditsRequested === true;
export function markMenuCredits(vm, running) {
  vm.menuCredits = running;
}
export const menuCreditsRunning = (vm) => vm?.menuCredits === true;
// PAD_HELD (7E:01CA) without a recorded access.
export const heldPad = (wram) => wram[PAD_HELD] | (wram[PAD_HELD + 1] << BYTE_BITS);

// The ending room: table entry 8 names room 5's header.
const ENDING_ROOM_ENTRY = 8;
const NO_MUSIC = WORD_MASK;
// The music byte of the ending room's header, read from the ROM view of the
// VM memory without a recorded access.
export const endingMusic = (memory) => {
  const read8 = (address) => memory.read8(address);
  return read8(roomHeader(read8, ENDING_ROOM_ENTRY) + ROOM_HEADER_MUSIC);
};
// True while no music plays (7E:1CDE = FFFF, 81:EF94).
export const musicSilent = (wram) => (wram[MUSIC] | (wram[MUSIC + 1] << BYTE_BITS)) === NO_MUSIC;
export function takeCreditsRequest(vm) {
  const requested = creditsRequested(vm);
  if (requested) vm.creditsRequested = false;
  return requested;
}
