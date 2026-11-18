// The routine table of the lifted main loop's callees (moved from src/vm/main-loop.mjs;
// the live main loop composes them directly and looks up no routine table). Register-
// level callers and the tests that check the bindings use it.
import {
  runCameraFollow,
  runColourEffect,
  runFormationStep,
  runHitShake,
  runObjectMotion,
  runPaletteCycles,
  runSpriteList,
  runTileBuffers,
  mainLoopNoticeSequence,
} from '../../src/game/main-upkeep.mjs';
import { runFrameWait, runPadPresses } from './input-routines.mjs';
import { SCENE_REQUEST_ENTRY, sceneRequestSequence } from '../../src/game/scene-request.mjs';
import { playerZonesSequence } from '../../src/game/player-zones.mjs';
import { timeLimitSequence } from '../../src/game/time-limit.mjs';
import { gloveActionSequence } from '../../src/game/glove-action.mjs';
import { gloveMoveSequence } from '../../src/game/glove-move.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from '../../src/system/native-call-continuation.mjs';
import { FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';

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

// The register-level entries of the main loop callees that wait.
// 80:FF14, called with JSR; its window releases wait for the NMI of their uploads.
export function runNoticeTimeouts(h, events) {
  return drainNativeSequence(mainLoopNoticeSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(0x80ff14, {
  run: runNoticeTimeouts,
  create: ({ h, events }) => new NativeCallContinuation(h.a, mainLoopNoticeSequence(h, events)),
});

// 80:E270, called with JSR; its notice and text wait for the NMI of their uploads, so
// it is a native call continuation of the main loop.
export function runTimeLimit(h, events) {
  return drainNativeSequence(timeLimitSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(0x80e270, {
  run: runTimeLimit,
  create: ({ h, events }) => new NativeCallContinuation(h.a, timeLimitSequence(h, events)),
});

// 80:BF3B, called with JSR; its notice, menu, dialog and input wait for the NMI, so it
// is a native call continuation of the main loop.
export function runGloveAction(h, events) {
  return drainNativeSequence(gloveActionSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(0x80bf3b, {
  run: runGloveAction,
  create: ({ h, events }) => new NativeCallContinuation(h.a, gloveActionSequence(h, events)),
});

// 80:BE6D, called with JSR; its object search and release wait for the NMI, so it is
// a native call continuation of the main loop. The glove natives bind the register-level
// version to the same target, so this continuation is found by its run function.
// The object search opens the name window with the lifted 80:F963 and prints the name
// with the lifted text 80:FE69 and text buffer 80:FB39.
export function runGloveMove(h, events) {
  return drainNativeSequence(gloveMoveSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runGloveMove, {
  run: runGloveMove,
  create: ({ h, events }) => new NativeCallContinuation(h.a, gloveMoveSequence(h, events)),
});

// 80:8000, called with JSR; its scene change waits for the NMI, so it is a native
// call continuation of the main loop. The register-level reference keeps the target's
// registration, so this one is found by its run function.
// The zones append their script tasks with the lifted task append 80:C34A. The register
// form leaves the carry set after a scene change.
export function runPlayerZones(h, events) {
  return drainNativeSequence(playerZonesRoutineSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runPlayerZones, {
  run: runPlayerZones,
  create: ({ h, events }) => new NativeCallContinuation(h.a, playerZonesRoutineSequence(h, events)),
});

// The register form for register-level callers: the carry set after a scene change.
export function* playerZonesRoutineSequence(h, events) {
  const zones = {},
    result = yield* playerZonesSequence(h, events, zones);
  h.ctx.status = zones.changed ? h.ctx.status | FLAG_CARRY : h.ctx.status & ~FLAG_CARRY;
  return result;
}
// The register form: the carry set when the request was taken.
export function* sceneRequestRoutineSequence(h, events) {
  const request = {},
    result = yield* sceneRequestSequence(h, events, request);
  h.ctx.status = request.taken ? h.ctx.status | FLAG_CARRY : h.ctx.status & ~FLAG_CARRY;
  return result;
}

// The run wrapper for the main loop's routine table.
export function processSceneRequest(h, events) {
  return drainNativeSequence(sceneRequestRoutineSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(SCENE_REQUEST_ENTRY, {
  run: processSceneRequest,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, sceneRequestRoutineSequence(h, events)),
});
