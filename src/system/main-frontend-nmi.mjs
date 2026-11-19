// The NMI callbacks of the frontend: the lifted prologue, pan and vertical scroll
// callbacks 81:DD54, 81:D93E and 81:DCAC (src/frontend/title.mjs; register-level
// reference in proof/frontend-reference/title.mjs).
import { INTRO_NMI_ROUTINES } from './main-intro-nmi.mjs';
import { handleGameNmi } from '../game/game-nmi.mjs';
import { handleMatrixNmi } from '../matrix/matrix-scene.mjs';
import { handleCutsceneNmi } from '../cutscene/cutscene-scene.mjs';
import { handlePrologueNmi, handleTitlePanNmi, handleTitleScrollNmi } from '../frontend/title.mjs';
import { handleStartMenuNmi } from '../frontend/start-menu.mjs';

export const FRONTEND_NMI_ROUTINES = new Map([
  ...INTRO_NMI_ROUTINES,
  // The live game always runs lag-free frames, so it binds the lifted game NMI handler,
  // which calls its jobs directly; the jobs' table entries for register-level callers live
  // in proof/caller/game-nmi-jobs.mjs, and recorded runs compose their register-level
  // references in proof/replay/game-nmi-jobs.mjs.
  [0x80c152, handleGameNmi],
  [0x81bec3, handleMatrixNmi],
  [0x81d479, handleCutsceneNmi],
  [0x81e6ae, handleStartMenuNmi],
  // The boot screens install a callback that immediately returns (81:E839).
  [0x81e839, (h) => h.rtl()],
  [0x81dd54, handlePrologueNmi],
  [0x81d93e, handleTitlePanNmi],
  [0x81dcac, handleTitleScrollNmi],
]);
