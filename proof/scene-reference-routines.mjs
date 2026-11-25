// The routine table of the register-level scene references: the game NMI's
// register-level jobs (proof/replay/main-game-nmi.mjs), the start of a game
// (proof/game-reference/game-start.mjs) with its game screen set-up and room entry,
// and the register-level audio (proof/apu-reference/) in place of their lifted
// versions. The ROM proof tests run the scenes with it. The matrix 81:C3CA, the
// cutscenes 81:CDF8, the intro 81:DFE7 with their NMI callbacks and the frontend (title,
// start menu, title cycle, game owner) run lifted (src/matrix, src/cutscene, src/intro,
// src/frontend); their register-level references were retired on 2026-11-25, when the
// golden traces covered them (docs/STATE-MODEL-REBUILD.md).
import { MAIN_SCENE_ROUTINES } from './replay/main-scene.mjs';
import { AUDIO_REFERENCE_ENTRIES } from './apu-reference/audio-routines.mjs';
import { GAME_START_REFERENCE_ENTRIES } from './game-reference/game-start.mjs';
import { GAME_SCREEN_REFERENCE_ENTRIES } from './game-reference/game-screen.mjs';
import { ROOM_ENTRY_REFERENCE_ENTRIES } from './game-reference/room-entry.mjs';
import { GAME_NMI_ROUTINES } from './replay/main-game-nmi.mjs';
import { playCutscene, playIntro, playMatrixScene } from './replay/main-scene.mjs';
import { handleMatrixNmi } from '../src/matrix/matrix-scene.mjs';
import { handleCutsceneNmi } from '../src/cutscene/cutscene-scene.mjs';
import { handleIntroNmi } from '../src/intro/intro-scene.mjs';

export const SCENE_REFERENCE_ROUTINES = new Map([
  ...MAIN_SCENE_ROUTINES,
  ...AUDIO_REFERENCE_ENTRIES,
  [0x81c3ca, playMatrixScene],
  [0x81bec3, handleMatrixNmi],
  [0x81cdf8, playCutscene],
  [0x81d479, handleCutsceneNmi],
  [0x81dfe7, playIntro],
  [0x81df0e, handleIntroNmi],
  ...GAME_START_REFERENCE_ENTRIES,
  ...GAME_SCREEN_REFERENCE_ENTRIES,
  ...ROOM_ENTRY_REFERENCE_ENTRIES,
  ...GAME_NMI_ROUTINES,
]);
