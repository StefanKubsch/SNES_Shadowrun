// Live main-loop caller 80:96AB-96F2: direct composition of its upkeep bodies.
// Former address dispatch is retained in proof/caller/main-loop.mjs. The zones and the
// scene request report a new pass as values; the loop leaves no A, X, Y or flags (user
// decision 2026-11-17). Shared call frames remain until the callees and NMI no longer
// need them.
import { taskStop } from '../system/task-stop.mjs';
import { dialogAccess } from '../system/native-dialog-support.mjs';
import {
  mainLoopNoticeSequence,
  mainLoopFrameWaitSequence,
  mainLoopTimeLimitSequence,
  mainLoopGloveActionSequence,
  mainLoopGloveMoveSequence,
  mainLoopPlayerZonesSequence,
  runTileBuffers,
  runObjectMotion,
  runSpriteList,
  takePadWord,
} from '../game/main-upkeep.mjs';
import { sceneRequestSequence } from '../game/scene-request.mjs';
import { shakeHitPlayer } from '../game/player-hit.mjs';
import { recordFormationStep } from '../game/formation-trail.mjs';
import { followPlayerWithCamera } from '../game/camera-follow.mjs';
import { advancePaletteCycles } from '../game/palette-cycles.mjs';
import { applyColourEffect } from '../game/fixed-colour.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { lagFree } from '../system/main-wait-interrupt.mjs';
import {
  NativeCallContinuation,
  dialogCallBody,
  segmentSequence,
} from '../system/native-call-continuation.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';
import { MAIN_LOOP_EXIT, MAIN_LOOP_RELOAD } from '../data/wram.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';

export const MAIN_LOOP_RESUME = 0x96c3; // return from the round
export const MAIN_LOOP_ROUND = 0x96c0; // JSR $C1E3
const MAIN_LOOP_START = 0x96ab; // first pass after 9688
// Original call sites in 80:96AB-96E4, named by the routine they call.
const CALL_PC = Object.freeze({
  GATE_8000: MAIN_LOOP_RESUME,
  CC4B: 0x96c8,
  AFC4: 0x96d0,
  CAMERA_8A91: 0x96da,
  SPRITES_B8DE: 0x96de,
  FF14: 0x96e1,
  TIMER_E270: 0x96e4,
  WAIT_B0A1: MAIN_LOOP_START,
  INPUT_9E1A: 0x96b7,
  BF3B: 0x96bd,
});
const MAIN_LOOP_EXIT_PC = 0x96ec,
  MAIN_LOOP_RELOAD_PC = 0x96f2;
// The main loop from 96C3 or the first 96AB up to the next scheduler round.
export function* mainLoopSequence(a, events, returnToOwner = false) {
  const { ctx } = a,
    { wram } = a.mem;
  // Only the entry point is checked: the lifted callees compute in binary on game state
  // and read no register widths (user decision 2026-11-17); the register-level entry and
  // return width checks stay with proof/vm/main-loop.mjs.
  if (ctx.programBank !== CODE_BANK || ![MAIN_LOOP_RESUME, MAIN_LOOP_START].includes(ctx.pc))
    taskStop('main_loop_entry_required', { pc: ctx.pc });
  const h = dialogAccess(a);
  if (!lagFree(events)) taskStop('game_lag_free_required');
  const call = (pc, target, body, long = false) =>
    dialogCallBody(h, CODE_BANK_BASE | pc, target, body, long);
  const once = (run) => () => segmentSequence(() => run(h, events));
  if (ctx.pc === MAIN_LOOP_START) return yield* top();
  // $96C3–$96E4; a scene change by a zone starts the next pass at once.
  const zones = {};
  yield* call(CALL_PC.GATE_8000, 0x808000, () => mainLoopPlayerZonesSequence(h, events, zones));
  if (zones.changed) return yield* top();
  const request = {};
  yield* call(CALL_PC.CC4B, 0x80cc4b, () => sceneRequestSequence(h, events, request));
  if (request.taken) return yield* top();
  yield () => shakeHitPlayer(wram);
  yield* call(CALL_PC.AFC4, 0x80afc4, once(runObjectMotion));
  yield () => recordFormationStep(wram);
  yield () => followPlayerWithCamera(a.mem, wram);
  yield* call(CALL_PC.CAMERA_8A91, 0x818a91, once(runTileBuffers), true);
  yield* call(CALL_PC.SPRITES_B8DE, 0x80b8de, once(runSpriteList));
  yield* call(CALL_PC.FF14, 0x80ff14, () => mainLoopNoticeSequence(h, events));
  yield* call(CALL_PC.TIMER_E270, 0x80e270, () => mainLoopTimeLimitSequence(h, events));
  // The game leaves the loop to its owner when it ends (7E:1FDA) or reloads (7E:1FD8).
  for (const [word, pc] of [
    [MAIN_LOOP_EXIT, MAIN_LOOP_EXIT_PC],
    [MAIN_LOOP_RELOAD, MAIN_LOOP_RELOAD_PC],
  ]) {
    if (!(wram[word] | (wram[word + 1] << BYTE_BITS))) continue;
    if (returnToOwner) return h.rts();
    taskStop('main_loop_exit', { pc });
  }
  return yield* top();

  // $96AB–$96BD, then the loop stands before JSR $C1E3.
  function* top() {
    yield* call(CALL_PC.WAIT_B0A1, 0x81b0a1, () => mainLoopFrameWaitSequence(h, events), true);
    yield () => applyColourEffect(sceneRuntime(h));
    yield () => advancePaletteCycles(wram);
    yield* call(CALL_PC.INPUT_9E1A, 0x809e1a, once(takePadWord));
    yield* mainLoopGloveMoveSequence(h, events);
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
