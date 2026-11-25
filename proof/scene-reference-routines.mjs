// The routine table of the register-level scene references: the matrix
// (proof/matrix-reference/), the game NMI's register-level jobs
// (proof/replay/main-game-nmi.mjs) and the frontend (proof/frontend-reference/, with
// the audio of proof/apu-reference/) in place of their lifted versions. The ROM proof
// tests run the scenes with it. The cutscenes 81:CDF8 with their NMI callback 81:D479
// and the intro 81:DFE7 with its NMI callback 81:DF0E run lifted (src/cutscene,
// src/intro); their register-level references were retired on 2026-11-25, when the
// golden traces cutscenes, intro and attract covered them
// (docs/STATE-MODEL-REBUILD.md).
import { MATRIX_REFERENCE_ROUTINES } from './matrix-reference/matrix-scene-loop.mjs';
import { FRONTEND_REFERENCE_ENTRIES } from './frontend-reference/frontend.mjs';
import { GAME_NMI_ROUTINES } from './replay/main-game-nmi.mjs';
import { playCutscene, playIntro } from './replay/main-scene.mjs';
import { handleCutsceneNmi } from '../src/cutscene/cutscene-scene.mjs';
import { handleIntroNmi } from '../src/intro/intro-scene.mjs';

export const SCENE_REFERENCE_ROUTINES = new Map([
  ...MATRIX_REFERENCE_ROUTINES,
  [0x81cdf8, playCutscene],
  [0x81d479, handleCutsceneNmi],
  [0x81dfe7, playIntro],
  [0x81df0e, handleIntroNmi],
  ...FRONTEND_REFERENCE_ENTRIES,
  ...GAME_NMI_ROUTINES,
]);
