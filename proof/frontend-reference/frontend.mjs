// The register-level frontend references in place of the lifted title
// (title.mjs), start menu (start-menu.mjs, start-menu-text.mjs), title cycle and
// attract game (title-cycle.mjs) and outer game owner (game-owner.mjs), with the start
// of a game (proof/game-reference/game-start.mjs) with its game screen set-up
// (game-screen.mjs) and room entry (room-entry.mjs), and the register-level audio
// (proof/apu-reference/audio-routines.mjs), for the ROM proof tests and the replays
// of recorded chronologies.
import { TITLE_REFERENCE_ENTRIES } from './title.mjs';
import { START_MENU_REFERENCE_ENTRIES } from './start-menu.mjs';
import { TITLE_CYCLE_REFERENCE_ENTRIES } from './title-cycle.mjs';
import { GAME_OWNER_REFERENCE_ENTRIES } from './game-owner.mjs';
import { GAME_START_REFERENCE_ENTRIES } from '../game-reference/game-start.mjs';
import { AUDIO_REFERENCE_ENTRIES } from '../apu-reference/audio-routines.mjs';
import { GAME_SCREEN_REFERENCE_ENTRIES } from '../game-reference/game-screen.mjs';
import { ROOM_ENTRY_REFERENCE_ENTRIES } from '../game-reference/room-entry.mjs';

export const FRONTEND_REFERENCE_ENTRIES = [
  ...TITLE_REFERENCE_ENTRIES,
  ...START_MENU_REFERENCE_ENTRIES,
  ...TITLE_CYCLE_REFERENCE_ENTRIES,
  ...GAME_OWNER_REFERENCE_ENTRIES,
  ...GAME_START_REFERENCE_ENTRIES,
  ...AUDIO_REFERENCE_ENTRIES,
  ...GAME_SCREEN_REFERENCE_ENTRIES,
  ...ROOM_ENTRY_REFERENCE_ENTRIES,
];
// A copy of a routine table with the frontend references.
export const withFrontendReference = (routines) =>
  new Map([...routines, ...FRONTEND_REFERENCE_ENTRIES]);
