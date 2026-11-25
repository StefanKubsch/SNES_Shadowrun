// The NMI routines of the intro and title for recorded runs: the live callbacks
// (src/system/main-intro-nmi.mjs) and the shared register-level routines that
// recorded interrupt observations call from their original sites. The sprite grid
// 81:E83A, far object start 81:E971 and near object sound 81:E900 are lifted
// (register-level entries in proof/caller/intro-setup-entries.mjs).
import { INTRO_NMI_ROUTINES as INTRO_NMI_CALLBACKS } from '../../src/system/main-intro-nmi.mjs';
import {
  sendOamBuffer,
  clearOamHighTable,
  hideRemainingSprites,
} from '../system/main-scene-video.mjs';
import { readJoypadLong } from '../system/main-scene-wait.mjs';
import { runObservedNmi } from '../../src/system/nmi-call.mjs';
import { sendApuCommand } from '../system/native-input-apu.mjs';
import { handlePanObjects } from '../caller/scene-routine-adapters.mjs';

export const INTRO_NMI_ROUTINES = new Map([
  ...INTRO_NMI_CALLBACKS,
  // 81:D9D5 entered on its own (proof/caller/scene-routine-adapters.mjs).
  [0x81d9d5, handlePanObjects],
  [0x81ed8b, sendOamBuffer],
  [0x81edd7, clearOamHighTable],
  [0x81ee0c, hideRemainingSprites],
  [0x80f290, readJoypadLong],
  [0x81f007, (h) => sendApuCommand(h.a, false)],
]);
export const runObservedIntroNmi = (a, e = null, r = INTRO_NMI_ROUTINES) => runObservedNmi(a, e, r);
