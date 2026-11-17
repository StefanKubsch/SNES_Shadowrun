// Run wrappers of the lifted game start for register-level routine tables: the main
// start (the driver's entry), the new game state and the save load for their
// original callers (lifted bodies in src/game/game-start.mjs).
import { gameStartSequence, setUpNewGameState, loadSavedGame } from '../../src/game/game-start.mjs';
import { WORD_MASK } from '../../src/constants/bits.mjs';
import { drainNativeSequence } from '../../src/system/native-call-continuation.mjs';

export function runGameStart(h, e) {
  return drainNativeSequence(gameStartSequence(h, e));
}
export function runNewGameState(h) {
  setUpNewGameState(h.a);
  return h.rts();
}
export function runSaveLoad(h) {
  loadSavedGame(h.a, h.ctx.a & WORD_MASK);
  return h.rtl();
}
