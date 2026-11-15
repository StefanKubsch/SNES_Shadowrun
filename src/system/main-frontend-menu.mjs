import { frontendContinuations, FRONTEND_TEXT_ROUTINES } from './main-frontend-text.mjs';

import { drainNativeSequence } from './native-call-continuation.mjs';
import { titleSequence } from '../frontend/title.mjs';
import { startMenuSequence } from '../frontend/start-menu.mjs';
import {
  attractGameSequence,
  runAttractGame,
  runTitleCycle,
  titleCycleSequence,
} from '../frontend/title-cycle.mjs';

// 81:E14A: the start menu (src/frontend/start-menu.mjs).
export function openStartMenu(h, e, r = FRONTEND_MENU_ROUTINES) {
  return drainNativeSequence(startMenuSequence(h, e, r));
}
// 81:D694: the prologue and the title (src/frontend/title.mjs).
export function playTitle(h, e, r = FRONTEND_MENU_ROUTINES) {
  return drainNativeSequence(titleSequence(h, e, r));
}
export const FRONTEND_MENU_ROUTINES = new Map([
  ...FRONTEND_TEXT_ROUTINES,
  // The lifted start menu, title, title cycle and attract game (src/frontend).
  [0x81e14a, openStartMenu],
  [0x81d694, playTitle],
  [0x80a168, runAttractGame],
  [0x80a18c, runTitleCycle],
]);
frontendContinuations(
  [
    [0x81e14a, openStartMenu, startMenuSequence],
    [0x81d694, playTitle, titleSequence],
    [0x80a18c, runTitleCycle, titleCycleSequence],
    [0x80a168, runAttractGame, attractGameSequence],
  ],
  () => FRONTEND_MENU_ROUTINES,
);
