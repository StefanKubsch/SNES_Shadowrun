// The NMI callbacks of the frontend: the lifted prologue, pan and vertical scroll
// callbacks 81:DD54, 81:D93E and 81:DCAC (src/frontend/title.mjs; register-level
// reference in proof/frontend-reference/title.mjs).
import { FRONTEND_TEXT_ROUTINES } from './main-frontend-text.mjs';
import { handlePrologueNmi, handleTitlePanNmi, handleTitleScrollNmi } from '../frontend/title.mjs';

export const FRONTEND_NMI_ROUTINES = new Map([
  ...FRONTEND_TEXT_ROUTINES,
  // The boot screens install a callback that immediately returns (81:E839).
  [0x81e839, (h) => h.rtl()],
  [0x81dd54, handlePrologueNmi],
  [0x81d93e, handleTitlePanNmi],
  [0x81dcac, handleTitleScrollNmi],
]);
