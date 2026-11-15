// The routine table of the start of a game and the main driver's entry into the
// main start 80:9688 (lifted in src/game/game-start.mjs; the register-level
// reference is proof/game-reference/game-start.mjs).
import { dialogAccess } from './native-dialog-support.mjs';
import { unpackStream } from './native-unpack.mjs';
import { MAIN_INITIALIZE_ROUTINES } from './main-initialize.mjs';
import { TRANSITION_ROUTINES } from './main-transition.mjs';
import { NativeCallContinuation } from './native-call-continuation.mjs';
import {
  GAME_START,
  requireGameStartEntry,
  gameStartSequence,
  runGameStart,
  runNewGame,
  runNewGameState,
  runSaveLoad,
} from '../game/game-start.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';

export const MAIN_START = GAME_START;
const MAIN_START_TARGET = CODE_BANK_BASE | GAME_START;

export const MAIN_START_ROUTINES = new Map([
  ...MAIN_INITIALIZE_ROUTINES,
  ...TRANSITION_ROUTINES,
  [MAIN_START_TARGET, runGameStart],
  [0x80960d, runNewGame],
  [0x8098e9, runNewGameState],
  [0x81b198, runSaveLoad],
  // The register-level unpacker for the reference new game state 80:98E9.
  [0x809f4d, (h, e) => unpackStream(h.a, false, e)],
]);

// Live callers enter the lifted start directly. The table above remains shared
// helper bindings for room entry; address-dispatched callers live in proof/caller/.
export function runMainStart(a, e = null, r = MAIN_START_ROUTINES) {
  requireGameStartEntry(a.ctx);
  return runGameStart(dialogAccess(a), e, r);
}
export function mainStartContinuation(a, e = null, r = MAIN_START_ROUTINES) {
  requireGameStartEntry(a.ctx);
  return new NativeCallContinuation(a, gameStartSequence(dialogAccess(a), e, r));
}
