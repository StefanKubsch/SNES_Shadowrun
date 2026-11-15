// Shared helper and interrupt bindings for the live game. The outer owner, title
// cycle and attract demo compose their callees directly in src/frontend/.
import { FRONTEND_NMI_ROUTINES } from './main-frontend-nmi.mjs';
import { MAIN_START_ROUTINES } from './main-start.mjs';
import { MAIN_LOOP_ROUTINES } from '../vm/main-loop.mjs';
import { runTileBuffers } from '../game/main-upkeep.mjs';
export const FRONTEND_ROUTINES = new Map([
  ...MAIN_START_ROUTINES,
  ...MAIN_LOOP_ROUTINES,
  ...FRONTEND_NMI_ROUTINES,
  [0x818a91, runTileBuffers],
]);
