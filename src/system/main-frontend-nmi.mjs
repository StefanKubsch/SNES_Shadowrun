// The NMI callbacks of the frontend: the lifted prologue, pan and vertical scroll
// callbacks 81:DD54, 81:D93E and 81:DCAC (src/frontend/title.mjs; register-level
// reference in proof/frontend-reference/title.mjs).
import { INTRO_NMI_ROUTINES } from './main-intro-nmi.mjs';
import { GAME_NMI_ROUTINES } from './main-game-nmi.mjs';
import { GAME_NMI_LIFTED_JOBS } from '../game/game-nmi.mjs';
import { handleMatrixNmi } from '../matrix/matrix-scene.mjs';
import { handleCutsceneNmi } from '../cutscene/cutscene-scene.mjs';
import { sendApuCommandRoutine } from '../apu/audio-routines.mjs';
import { handlePrologueNmi, handleTitlePanNmi, handleTitleScrollNmi } from '../frontend/title.mjs';
import { handleStartMenuNmi } from '../frontend/start-menu.mjs';

export const FRONTEND_NMI_ROUTINES = new Map([
  ...INTRO_NMI_ROUTINES,
  ...GAME_NMI_ROUTINES,
  ...GAME_NMI_LIFTED_JOBS,
  [0x81bec3, handleMatrixNmi],
  [0x81d479, handleCutsceneNmi],
  [0x81f007, sendApuCommandRoutine],
  [0x81e6ae, handleStartMenuNmi],
  // The boot screens install a callback that immediately returns (81:E839).
  [0x81e839, (h) => h.rtl()],
  [0x81dd54, handlePrologueNmi],
  [0x81d93e, handleTitlePanNmi],
  [0x81dcac, handleTitleScrollNmi],
]);
