// The NMI routines of the intro and title: the lifted callbacks (src/intro, src/frontend)
// and the shared register-level routines they bind. The register-level sprite grid
// 81:E83A, far object start 81:E971 and near object sound 81:E900 are references in
// proof/intro-reference/.
import { sendOamBuffer } from './main-scene-video.mjs';
import { clearOamHighTable, hideRemainingSprites } from './main-scene-video.mjs';
import { readJoypadLong } from './main-scene-wait.mjs';
import { runObservedNmi } from './observed-nmi.mjs';
import { sendApuCommand } from './native-input-apu.mjs';

import { handleIntroNmi } from '../intro/intro-scene.mjs';
import { handlePanObjects, handleTitleObjectsNmi } from '../frontend/title.mjs';

export const INTRO_NMI_ROUTINES = new Map([
  // The lifted title callbacks (src/frontend/title.mjs).
  [0x81dad6, handleTitleObjectsNmi],
  [0x81d9d5, handlePanObjects],
  // The lifted intro callback (src/intro/intro-scene.mjs).
  [0x81df0e, handleIntroNmi],
  [0x81ed8b, sendOamBuffer],
  [0x81edd7, clearOamHighTable],
  [0x81ee0c, hideRemainingSprites],
  [0x80f290, readJoypadLong],
  [0x81f007, (h) => sendApuCommand(h.a, false)],
]);
export const runObservedIntroNmi = (a, e = null, r = INTRO_NMI_ROUTINES) => runObservedNmi(a, e, r);
