// Former live title-cycle bindings, separate from recorded replays.
import { FRONTEND_NMI_ROUTINES } from '../../src/system/main-frontend-nmi.mjs';
import { frontendContinuations } from '../replay/main-frontend-text.mjs';
import { openStartMenu, playTitle } from '../replay/main-frontend-menu.mjs';
import {
  attractGameSequence,
  runAttractGame,
  runTitleCycle,
  titleCycleSequence,
} from '../frontend-caller/title-cycle.mjs';
export const FRONTEND_MENU_ROUTINES = new Map([
  ...FRONTEND_NMI_ROUTINES,
  [0x81e14a, openStartMenu],
  [0x81d694, playTitle],
  [0x80a168, runAttractGame],
  [0x80a18c, runTitleCycle],
]);
frontendContinuations(
  [
    [0x80a168, runAttractGame, attractGameSequence],
    [0x80a18c, runTitleCycle, titleCycleSequence],
  ],
  () => FRONTEND_MENU_ROUTINES,
);
