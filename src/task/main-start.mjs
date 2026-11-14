// The routine table of the start of a game and the main driver's entry into the
// main start 80:9688 (lifted in src/game/game-start.mjs; the register-level
// reference is proof/game-reference/game-start.mjs).
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { unpackStream } from './native-unpack.mjs';
import { MAIN_INITIALIZE_ROUTINES } from './main-initialize.mjs';
import { TRANSITION_ROUTINES } from './main-transition.mjs';
import { NATIVE_CALL_CONTINUATIONS, NativeCallContinuation } from './native-call-continuation.mjs';
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

// The main driver enters the main start (the table's entry 80:9688, or its proof
// reference) after the outer owner's JSR 9688; it stops before the first main loop
// call at 96AB. No return is fabricated.
const startOf = (a, r) => {
  // Checked before the accessor needs direct page 0.
  requireGameStartEntry(a.ctx);
  const run = r.get(MAIN_START_TARGET);
  if (!run) taskStop('main_loop_frontier', { target: MAIN_START_TARGET });
  return run;
};
export function runMainStart(a, e = null, r = MAIN_START_ROUTINES) {
  return startOf(a, r)(dialogAccess(a), e, r);
}
export function mainStartContinuation(a, e = null, r = MAIN_START_ROUTINES) {
  const run = startOf(a, r),
    byTarget = NATIVE_CALL_CONTINUATIONS.get(MAIN_START_TARGET),
    factory = byTarget?.run === run ? byTarget : NATIVE_CALL_CONTINUATIONS.get(run);
  if (!factory) taskStop('main_start_continuation_required', { target: MAIN_START_TARGET });
  return factory.create({ h: dialogAccess(a), events: e, routines: r });
}
NATIVE_CALL_CONTINUATIONS.set(MAIN_START_TARGET, {
  run: runGameStart,
  create: ({ h, events, routines = MAIN_START_ROUTINES }) =>
    new NativeCallContinuation(h.a, gameStartSequence(h, events, routines)),
});
