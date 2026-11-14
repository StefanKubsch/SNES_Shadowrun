// Register-level reference of the scene request 80:CC4B of the main loop (moved
// from src/task/main-loop-motion.mjs; lifted in src/game/scene-request.mjs). Its
// callees stay register-level in the main loop's motion table
// (MAIN_MOTION_ROUTINES), which this reference calls through their original
// frames: the forced blank 81:B0BD, the frame wait 81:B0A1, the cutscene 81:CDF8,
// the matrix 81:C3CA, the game screen set-up 80:9629 and the room entry 80:A4BF.
//
// $1CE9 = FFFF: no new scene; 7FFF: only a scene change; otherwise load first.
// FFFE loads via C3CA and takes the byte $1D8B into the record, other values via CDF8.
import { MAIN_MOTION_ROUTINES } from '../../src/task/main-loop-motion.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  nativeCallSequence,
} from '../../src/task/native-call-continuation.mjs';
import {
  DECKER_HEALTH,
  DECKER_RECORD,
  RECORD_COUNT,
  ROOM,
  SCENE_REQUEST,
  SCENE_REQUEST_ARGUMENT,
  WRAM,
} from '../../src/task/wram.mjs';
import { WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_CARRY, FLAG_MEMORY_8BIT, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

// SCENE_REQUEST values: none, a room change only, the matrix (any other value names a sequence).
const SCENE_NONE = 0xffff,
  SCENE_ROOM_ONLY = 0x7fff,
  SCENE_MATRIX = 0xfffe;
const callReturn = (address) => address & WORD_MASK;

export function processSceneRequestReference(h, events, routines = MAIN_MOTION_ROUTINES) {
  return drainNativeSequence(mainSceneRequestSequence(h, events, routines));
}
function* mainSceneRequestSequence(h, events, routines) {
  const { ctx } = h,
    invoke = (pc, target, long = false) =>
      nativeCallSequence(h, events, routines, pc, target, long, false);
  let result;
  yield () => {
    h.load(h.read(h.abs(SCENE_REQUEST)));
    h.cmp(SCENE_NONE);
  };
  if (ctx.status & FLAG_ZERO) {
    yield () => {
      ctx.status &= ~FLAG_CARRY;
      result = h.rts();
    };
    return result;
  }
  yield () => h.cmp(SCENE_ROOM_ONLY);
  if (!(ctx.status & FLAG_ZERO)) {
    yield* invoke(callReturn(0x80cc58), 0x81b0bd, true);
    yield* invoke(callReturn(0x80cc5c), 0x81b0a1, true);
    yield () => {
      h.index('x', h.read(h.abs(SCENE_REQUEST_ARGUMENT)));
      h.load(h.read(h.abs(SCENE_REQUEST)));
      h.cmp(SCENE_MATRIX);
    };
    if (!(ctx.status & FLAG_ZERO)) yield* invoke(callReturn(0x80cc6b), 0x81cdf8, true);
    else {
      yield* invoke(callReturn(0x80cc71), 0x81c3ca, true);
      yield () => {
        h.index('x', h.read(h.abs(DECKER_RECORD)));
        h.sep(FLAG_MEMORY_8BIT);
        h.load(h.read(h.abs(DECKER_HEALTH)));
        h.write(WRAM + RECORD_COUNT + ctx.x, ctx.a);
        h.rep(FLAG_MEMORY_8BIT);
      };
    }
    yield* invoke(callReturn(0x80cc83), 0x809629);
  }
  yield () => {
    h.load(SCENE_NONE);
    h.write(h.abs(SCENE_REQUEST), ctx.a);
    h.load(h.read(WRAM + ROOM));
  };
  yield* invoke(callReturn(0x80cc90), 0x80a4bf);
  yield () => {
    ctx.status |= FLAG_CARRY;
    result = h.rts();
  };
  return result;
}

export const SCENE_REQUEST_REFERENCE_ENTRIES = [[0x80cc4b, processSceneRequestReference]];
// The reference waits through its callees; its continuation is found by its run
// function, as the lifted request holds the target.
NATIVE_CALL_CONTINUATIONS.set(processSceneRequestReference, {
  run: processSceneRequestReference,
  create: ({ h, events, routines = MAIN_MOTION_ROUTINES }) =>
    new NativeCallContinuation(h.a, mainSceneRequestSequence(h, events, routines)),
});
