import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { NATIVE_CALL_CONTINUATIONS, drainNativeSequence } from './native-call-continuation.mjs';
import { FRONTEND_NMI_ROUTINES } from './main-frontend-nmi.mjs';
import { MAIN_START_ROUTINES } from './main-start.mjs';
import { roomStartSequence } from '../game/game-start.mjs';
import {
  MAIN_LOOP_ROUTINES,
  MAIN_LOOP_ROUND,
  MainLoopContinuation,
  runMainLoop,
} from '../vm/main-loop.mjs';
import { runTileBuffers } from '../game/main-upkeep.mjs';
import { dialogCallBody } from './native-call-continuation.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { frontendContinuations } from './main-frontend-text.mjs';
import { playAttractDemo } from '../frontend/title-cycle.mjs';
import {
  GAME_OWNER_ENTRY,
  GAME_OWNER_RESUME,
  gameOwnerSequence,
  runGameOwner,
} from '../frontend/game-owner.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
import { CODE_BANK_BASE } from '../constants/memory-map.mjs';
// The attract game's rounds run through the main round 80:C1E3.
const MAIN_ROUND = 0x80c1e3 & WORD_MASK,
  GAME_OWNER = CODE_BANK_BASE | GAME_OWNER_ENTRY;
// 80:9699 for the attract game (A = its room AB): the room start (lifted in
// src/game/game-start.mjs), then the main loop's rounds until the demo ends.
export function runAttractRounds(h, e, r = FRONTEND_ROUTINES) {
  return drainNativeSequence(attractRoundsSequence(h, e, r));
}
// roomStart: the room start's sequence (the proof reference passes its own).
export function* attractRoundsSequence(
  h,
  e,
  r,
  roomStart = () => roomStartSequence(h, e, r, h.ctx.a),
) {
  const { ctx } = h,
    live = !!lagFree(e);
  // Live, the loop pauses at its waits; recorded and isolated runs keep the
  // synchronous loop with their routine maps (MainLoopContinuation runs B0A1/9E1A itself).
  const loop = () =>
    live
      ? {
          continuation: new MainLoopContinuation(h.a, {
            events: e,
            routines: r,
            returnToOwner: true,
          }),
        }
      : () => runMainLoop(h.a, e, r, true);
  yield* roomStart();
  yield loop();
  while (ctx.pc === MAIN_LOOP_ROUND) {
    if (typeof e?.round !== 'function') taskStop('main_round_owner_required', { pc: 0x8096c0 });
    yield* dialogCallBody(h, 0x8096c0, 0x80c1e3, function* () {
      let more;
      if (live && typeof e.nestedRound === 'function') {
        const round = e.nestedRound(MAIN_ROUND);
        yield { continuation: round };
        more = round.result;
      } else
        yield () => {
          more = e.round(MAIN_ROUND);
        };
      if (more?.wait?.length) e.values = Object.freeze([...e.values, ...more.wait]);
      if (more?.input?.length) e.inputs = Object.freeze([...e.inputs, ...more.input]);
    });
    yield loop();
  }
}
// The demo owner 96F3 (src/frontend/title-cycle.mjs) calls 9699, which pauses at the
// main loop's waits.
frontendContinuations(
  [[0x809699, runAttractRounds, attractRoundsSequence]],
  () => FRONTEND_ROUTINES,
);
export const FRONTEND_ROUTINES = new Map([
  ...MAIN_START_ROUTINES,
  ...MAIN_LOOP_ROUTINES,
  ...FRONTEND_NMI_ROUTINES,
  [GAME_OWNER, runGameOwner],
  [0x8096f3, playAttractDemo],
  [0x809699, runAttractRounds],
  // The lifted tile buffers of the main loop, which the transition table above binds
  // register-level for its camera jump. The word wait and the pad word stay the menus'
  // register-level routines; the main loop runs its lifted entries in their place
  // (src/vm/main-loop.mjs).
  [0x818a91, runTileBuffers],
]);

export const MAIN_OWNER_ENTRY = GAME_OWNER_ENTRY,
  MAIN_OWNER_RESUME = GAME_OWNER_RESUME;
// The main driver enters the outer owner (the table's entry 80:A139, lifted in
// src/frontend/game-owner.mjs, or its proof reference) at A139 after the start-up
// and at A157 after a game; it ends at the main start 9688 with its JSR frame.
const ownerOf = (r) => {
  const run = r.get(GAME_OWNER);
  if (!run) taskStop('main_loop_frontier', { target: GAME_OWNER });
  return run;
};
export function runMainOwnerStart(a, e, r = FRONTEND_ROUTINES) {
  return ownerOf(r)(dialogAccess(a), e, r);
}
// The owner pauses inside the title cycle (title, menus, music beat waits).
export function mainOwnerContinuation(a, e, r = FRONTEND_ROUTINES) {
  const run = ownerOf(r),
    byTarget = NATIVE_CALL_CONTINUATIONS.get(GAME_OWNER),
    factory = byTarget?.run === run ? byTarget : NATIVE_CALL_CONTINUATIONS.get(run);
  if (!factory) taskStop('main_owner_continuation_required', { target: GAME_OWNER });
  return factory.create({ h: dialogAccess(a), events: e, routines: r });
}
frontendContinuations([[GAME_OWNER, runGameOwner, gameOwnerSequence]], () => FRONTEND_ROUTINES);
