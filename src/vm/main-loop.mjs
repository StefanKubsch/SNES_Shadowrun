// Live main-loop caller 80:96AB-96F2: direct composition of its upkeep bodies.
// Former address dispatch is retained in proof/caller/main-loop.mjs. Shared
// register frames remain until the callees and NMI no longer need them.
import { taskStop } from '../system/task-stop.mjs';
import { dialogAccess } from '../system/native-dialog-support.mjs';
import {
  mainLoopNoticeSequence,
  mainLoopFrameWaitSequence,
  mainLoopTimeLimitSequence,
  mainLoopGloveActionSequence,
  mainLoopGloveMoveSequence,
  mainLoopPlayerZonesSequence,
  runCameraFollow,
  runColourEffect,
  runFormationStep,
  runTileBuffers,
  runHitShake,
  runNoticeTimeouts,
  runPaletteCycles,
  runTimeLimit,
  runGloveAction,
  runGloveMove,
  runPlayerZones,
  runObjectMotion,
  runSpriteList,
  runFrameWait,
  runPadPresses,
} from '../game/main-upkeep.mjs';
import { processSceneRequest, sceneRequestSequence } from '../game/scene-request.mjs';
import { lagFree } from '../system/main-wait-interrupt.mjs';
import {
  NativeCallContinuation,
  dialogCallBody,
  segmentSequence,
} from '../system/native-call-continuation.mjs';
import { BYTE_BITS, WORD_SIGN } from '../constants/bits.mjs';
import {
  FLAG_DECIMAL,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_CARRY,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';
import { MAIN_LOOP_EXIT, MAIN_LOOP_RELOAD } from '../data/wram.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';

export const MAIN_LOOP_RESUME = 0x96c3; // return from the round
export const MAIN_LOOP_ROUND = 0x96c0; // JSR $C1E3
const MAIN_LOOP_START = 0x96ab; // first pass after 9688
// Original call sites in 80:96AB-96E4, named by the routine they call.
const CALL_PC = Object.freeze({
  GATE_8000: MAIN_LOOP_RESUME,
  CC4B: 0x96c8,
  DE94: 0x96cd,
  AFC4: 0x96d0,
  BAD5: 0x96d3,
  CAMERA_8C2E: 0x96d6,
  CAMERA_8A91: 0x96da,
  SPRITES_B8DE: 0x96de,
  FF14: 0x96e1,
  TIMER_E270: 0x96e4,
  WAIT_B0A1: MAIN_LOOP_START,
  ANIMATION_8877: 0x96af,
  PALETTE_8076: 0x96b3,
  INPUT_9E1A: 0x96b7,
  GLOVE_BE6D: 0x96ba,
  BF3B: 0x96bd,
});
const MAIN_LOOP_EXIT_PC = 0x96ec,
  MAIN_LOOP_RELOAD_PC = 0x96f2;
// Shared helper bindings, also used by retained proof callers.
// Bound subroutines of the main loop (grows with the deliveries).
export const MAIN_LOOP_ROUTINES = new Map([
  [0x808000, runPlayerZones], // zones around the player figure: append a task or change the scene
  [0x80cc4b, processSceneRequest],
  [0x80de94, runHitShake],
  [0x80afc4, runObjectMotion],
  [0x80bad5, runFormationStep],
  [0x818c2e, runCameraFollow],
  [0x818a91, runTileBuffers],
  [0x80b8de, runSpriteList],
  [0x80ff14, runNoticeTimeouts],
  [0x80e270, runTimeLimit],
  [0x81b0a1, runFrameWait],
  [0x818877, runColourEffect],
  [0x818076, runPaletteCycles],
  [0x809e1a, runPadPresses],
  [0x80be6d, runGloveMove],
  [0x80bf3b, runGloveAction],
]);

// The main loop from 96C3 or the first 96AB up to the next scheduler round.
export function* mainLoopSequence(a, events, returnToOwner = false) {
  const { ctx } = a,
    { wram } = a.mem;
  // The bound movement routines compute in binary. Reject invalid inputs before any WRAM effect.
  if (
    ctx.programBank !== CODE_BANK ||
    ![MAIN_LOOP_RESUME, MAIN_LOOP_START].includes(ctx.pc) ||
    ctx.d !== 0 ||
    ctx.status & (FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('main_loop_entry_required', { pc: ctx.pc });
  const h = dialogAccess(a);
  if (!lagFree(events)) taskStop('game_lag_free_required');
  const call = function* (pc, target, body, long = false) {
    yield* dialogCallBody(h, CODE_BANK_BASE | pc, target, body, long);
    if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
      taskStop('main_loop_return_width_required', { target });
  };
  const once = (run) => () => segmentSequence(() => run(h, events));
  const carry = () => (ctx.status & FLAG_CARRY) !== 0;
  if (ctx.pc === MAIN_LOOP_START) return yield* top();
  // $96C3–$96E4; a scene change by a zone starts the next pass at once.
  const zones = {};
  yield* call(CALL_PC.GATE_8000, 0x808000, () => mainLoopPlayerZonesSequence(h, events, zones));
  if (zones.changed) return yield* top();
  yield* call(CALL_PC.CC4B, 0x80cc4b, () => sceneRequestSequence(h, events));
  if (carry()) return yield* top();
  yield* call(CALL_PC.DE94, 0x80de94, once(runHitShake));
  yield* call(CALL_PC.AFC4, 0x80afc4, once(runObjectMotion));
  yield* call(CALL_PC.BAD5, 0x80bad5, once(runFormationStep));
  yield* call(CALL_PC.CAMERA_8C2E, 0x818c2e, once(runCameraFollow), true);
  yield* call(CALL_PC.CAMERA_8A91, 0x818a91, once(runTileBuffers), true);
  yield* call(CALL_PC.SPRITES_B8DE, 0x80b8de, once(runSpriteList));
  yield* call(CALL_PC.FF14, 0x80ff14, () => mainLoopNoticeSequence(h, events));
  yield* call(CALL_PC.TIMER_E270, 0x80e270, () => mainLoopTimeLimitSequence(h, events));
  // The game leaves the loop to its owner when it ends (7E:1FDA) or reloads (7E:1FD8);
  // the original loads each word, so A and its sign and zero are left as the original.
  for (const [request, pc] of [
    [MAIN_LOOP_EXIT, MAIN_LOOP_EXIT_PC],
    [MAIN_LOOP_RELOAD, MAIN_LOOP_RELOAD_PC],
  ]) {
    const value = wram[request] | (wram[request + 1] << BYTE_BITS);
    ctx.a = value;
    ctx.status &= ~(FLAG_ZERO | FLAG_NEGATIVE);
    if (!value) ctx.status |= FLAG_ZERO;
    if (value & WORD_SIGN) ctx.status |= FLAG_NEGATIVE;
    if (!value) continue;
    if (returnToOwner) return h.rts();
    taskStop('main_loop_exit', { pc });
  }
  return yield* top();

  // $96AB–$96BD, then the loop stands before JSR $C1E3.
  function* top() {
    yield* call(CALL_PC.WAIT_B0A1, 0x81b0a1, () => mainLoopFrameWaitSequence(h, events), true);
    yield* call(CALL_PC.ANIMATION_8877, 0x818877, once(runColourEffect), true);
    yield* call(CALL_PC.PALETTE_8076, 0x818076, once(runPaletteCycles), true);
    yield* call(CALL_PC.INPUT_9E1A, 0x809e1a, once(runPadPresses));
    yield* call(CALL_PC.GLOVE_BE6D, 0x80be6d, () => mainLoopGloveMoveSequence(h, events));
    yield* call(CALL_PC.BF3B, 0x80bf3b, () => mainLoopGloveActionSequence(h, events));
    ctx.pc = MAIN_LOOP_ROUND;
    return ctx.pc;
  }
}

// The common continuation handles direct caller segments and nested waits.
export class MainLoopContinuation extends NativeCallContinuation {
  constructor(a, { events = null, returnToOwner = false } = {}) {
    super(a, mainLoopSequence(a, events, returnToOwner));
  }
}
