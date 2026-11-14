// The routine table of the register-level scene references: the matrix
// (proof/matrix-reference/), the cutscenes (proof/cutscene-reference/), the intro
// (proof/intro-reference/), the game NMI's register-level jobs (src/task/main-game-nmi.mjs)
// and the frontend (proof/frontend-reference/, with the
// audio of proof/apu-reference/) in place of their lifted versions. The ROM proof
// tests run the scenes with it.
import { MATRIX_REFERENCE_ROUTINES } from './matrix-reference/matrix-scene-loop.mjs';
import { CUTSCENE_REFERENCE_ROUTINES } from './cutscene-reference/cutscene-scene.mjs';
import { INTRO_REFERENCE_ROUTINES } from './intro-reference/intro-scene.mjs';
import { FRONTEND_REFERENCE_ENTRIES } from './frontend-reference/frontend.mjs';
import { GAME_NMI_ROUTINES } from '../src/task/main-game-nmi.mjs';

export const SCENE_REFERENCE_ROUTINES = new Map([
  ...MATRIX_REFERENCE_ROUTINES,
  ...[0x81cdf8, 0x81cf72, 0x81cf79, 0x81d4e8, 0x81d37d, 0x81d479].map((target) => [
    target,
    CUTSCENE_REFERENCE_ROUTINES.get(target),
  ]),
  ...[0x81dfe7, 0x81df0e].map((target) => [target, INTRO_REFERENCE_ROUTINES.get(target)]),
  ...FRONTEND_REFERENCE_ENTRIES,
  ...GAME_NMI_ROUTINES,
]);
