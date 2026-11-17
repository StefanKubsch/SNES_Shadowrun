// The NMI callbacks of the intro and title objects: the lifted callbacks
// (src/intro, src/frontend). The live game always runs lag-free frames, so it
// needs no register-level helpers here; recorded runs add the sprite, joypad
// and sound helpers in proof/replay/intro-nmi-routines.mjs.
import { handleIntroNmi } from '../intro/intro-scene.mjs';
import { handleTitleObjectsNmi } from '../frontend/title.mjs';

export const INTRO_NMI_ROUTINES = new Map([
  // The lifted title callback (src/frontend/title.mjs).
  [0x81dad6, handleTitleObjectsNmi],
  // The lifted intro callback (src/intro/intro-scene.mjs).
  [0x81df0e, handleIntroNmi],
]);
