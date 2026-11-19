// Direct game start 80:9688. Address-dispatched helper bindings belong to
// proof/caller/main-start.mjs and proof/replay/main-start.mjs.
import { dialogAccess } from '../../src/system/native-dialog-support.mjs';
import { NativeCallContinuation } from '../../src/system/native-call-continuation.mjs';
import { GAME_START, gameStartSequence } from '../../src/game/game-start.mjs';
import { requireGameStartEntry } from '../caller/game-start.mjs';
import { runGameStart } from '../caller/game-start-runs.mjs';

export const MAIN_START = GAME_START;

// Live callers enter the lifted start directly.
export function runMainStart(a, e = null) {
  requireGameStartEntry(a.ctx);
  return runGameStart(dialogAccess(a), e);
}
export function mainStartContinuation(a, e = null) {
  requireGameStartEntry(a.ctx);
  return new NativeCallContinuation(a, gameStartSequence(dialogAccess(a), e));
}
