// The routine table of the register-level scene references: the game NMI's
// register-level jobs (proof/replay/main-game-nmi.mjs) and the frontend
// (proof/frontend-reference/, with the audio of proof/apu-reference/) in place of their
// lifted versions. The ROM proof tests run the scenes with it. The matrix 81:C3CA with
// its NMI callback 81:BEC3, the cutscenes 81:CDF8 with their NMI callback 81:D479 and
// the intro 81:DFE7 with its NMI callback 81:DF0E run lifted (src/matrix, src/cutscene,
// src/intro); their register-level references were retired on 2026-11-25, when the
// golden traces matrix, cutscenes, intro and attract covered them
// (docs/STATE-MODEL-REBUILD.md).
import { MAIN_SCENE_ROUTINES } from './replay/main-scene.mjs';
import { AUDIO_REFERENCE_ENTRIES } from './apu-reference/audio-routines.mjs';
import { FRONTEND_REFERENCE_ENTRIES } from './frontend-reference/frontend.mjs';
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
  ...FRONTEND_REFERENCE_ENTRIES,
  ...GAME_NMI_ROUTINES,
]);
