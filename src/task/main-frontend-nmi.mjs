// The NMI callbacks of the frontend: the lifted prologue, pan and vertical scroll
// callbacks 81:DD54, 81:D93E and 81:DCAC (src/frontend/title.mjs; register-level
// reference in proof/frontend-reference/title.mjs).
import { FRONTEND_MENU_ROUTINES } from './main-frontend-menu.mjs';
import { handlePrologueNmi, handleTitlePanNmi, handleTitleScrollNmi } from '../frontend/title.mjs';

export const FRONTEND_NMI_ROUTINES = new Map([
  ...FRONTEND_MENU_ROUTINES,
  [0x81dd54, handlePrologueNmi],
  [0x81d93e, handleTitlePanNmi],
  [0x81dcac, handleTitleScrollNmi],
]);
