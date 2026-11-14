// The register-level intro and title set-up routines (moved from src/task, lifted in
// src/intro and src/frontend) as routine table entries for the references: the
// sound directory 81:F092, the intro screen 81:D60F with its unpack list 81:D83E and
// first near objects 81:DC43, the window 81:D642, the title's and the game's audio
// 81:DDB1 and 81:EF63, the object clear 81:E8E5, the near object sound 81:E900, the
// sprite grid 81:E83A and the far object start 81:E971.
import { MAIN_SCENE_ROUTINES } from '../../src/task/main-scene.mjs';
import { AUDIO_REFERENCE_ENTRIES } from '../apu-reference/audio-routines.mjs';
import * as setup from './intro-setup.mjs';
import { drawIntroSpriteGrid, startFarIntroObject } from './intro-sprites.mjs';

// Calls without a table use the live scene routines with these entries (built on
// first use: the task tables are complete only after all modules have loaded).
let routines = null;
const defaultRoutines = () =>
  (routines ??= new Map([
    ...MAIN_SCENE_ROUTINES,
    ...AUDIO_REFERENCE_ENTRIES,
    ...INTRO_SETUP_REFERENCE_ENTRIES,
  ]));
export const INTRO_SETUP_REFERENCE_ENTRIES = [
  ...[
    [0x81f092, setup.loadSoundDirectory],
    [0x81d60f, setup.setupIntroScene],
    [0x81d83e, setup.unpackIntroList],
    [0x81dc43, setup.placeFirstNearObjects],
    [0x81d642, setup.setupIntroWindow],
    [0x81ddb1, setup.setupTitleAudio],
    [0x81e8e5, setup.clearIntroObjects],
    [0x81e900, setup.playNearObjectSound],
    [0x81ef63, setup.setupGameAudio],
  ].map(([target, run]) => [target, (h, e, r = defaultRoutines()) => run(h, e, r)]),
  [0x81e83a, drawIntroSpriteGrid],
  [0x81e971, startFarIntroObject],
  // The register-level audio routines these set-ups and the scene references call
  // (the song start 81:F229 and the sample loader 81:F130 left the scene table).
  ...AUDIO_REFERENCE_ENTRIES,
];
