// The scene request of the main loop (lifted from 80:CC4B; register-level
// reference in proof/game-reference/scene-request.mjs).
//
// Script code asks for a new scene by writing the scene request word 7E:1CE9:
// FFFF asks for nothing, 7FFF for the room (7E:2DE2) only, FFFE for the matrix and
// any other value for that cutscene, with its argument in 7E:1CEB. A scene blanks
// the screen, waits for the frame and plays; after the matrix the decker's health
// goes back into the decker's record. Then the game screen is set up again and,
// as for a room only, the request is cleared and the room entered. The main loop
// starts its next pass at its top when the request was taken (carry set).
//
// The forced blank 81:B0BD, the frame wait 81:B0A1 and the room entry 80:A4BF are
// the lifted ones of src/game/room-entry.mjs, the game screen set-up 80:9629 the one
// of src/game/game-screen.mjs. The cutscene 81:CDF8 and the matrix 81:C3CA are
// lifted scenes (src/cutscene, src/matrix) and keep the original's JSL frames: their
// waits take NMIs on that stack. The room entry runs below the return word of the
// original's JSR, as its frame waits do too.
import { tasksOf } from '../script/task-api.mjs';
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
  dialogCallBody,
} from '../system/native-call-continuation.mjs';
import { MAIN_SCENE_ROUTINES } from '../system/main-scene.mjs';
import { cutsceneSequence } from '../cutscene/cutscene-scene.mjs';
import { matrixSceneSequence } from '../matrix/matrix-scene.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { setUpGameScreen } from './game-screen.mjs';
import { enterRoomSequence, forceBlank, waitForFrameCall } from './room-entry.mjs';
import {
  DECKER_HEALTH,
  DECKER_RECORD,
  RECORD_COUNT,
  ROOM,
  SCENE_REQUEST,
  SCENE_REQUEST_ARGUMENT,
  SCENE_REQUEST_MATRIX,
  SCENE_REQUEST_ROOM_ONLY,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';

export const SCENE_REQUEST_ENTRY = 0x80cc4b;
const SCENE_REQUEST_NONE = WORD_MASK;
// Original call sites: the frame wait (JSL), the cutscene and the matrix (JSL), and
// the return word of the JSR to the room entry at 80:CC90.
const FRAME_WAIT_SITE = 0xcc5c,
  CUTSCENE_SITE = 0xcc6b,
  MATRIX_SITE = 0xcc71,
  ROOM_ENTRY_RETURN = 0xcc92;
const PLAY_CUTSCENE = 0x81cdf8,
  PLAY_MATRIX = 0x81c3ca;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// 80:CC4B: compose the live scenes and room directly. Carry reports whether a
// request was taken; the main caller restarts its pass after a transition.
export function* sceneRequestSequence(h, events) {
  const { ctx } = h,
    { wram } = sceneRuntime(h);
  const request = word(wram, SCENE_REQUEST);
  let result;
  if (request === SCENE_REQUEST_NONE) {
    yield () => {
      ctx.a = request;
      ctx.status &= ~FLAG_CARRY;
      result = h.rts();
    };
    return result;
  }
  if (request !== SCENE_REQUEST_ROOM_ONLY) {
    yield () => forceBlank(wram);
    yield* waitForFrameCall(h, events, FRAME_WAIT_SITE);
    // The scene takes the request, read again after the wait, in A and its argument
    // in X.
    let scene;
    yield () => {
      scene = word(wram, SCENE_REQUEST);
      ctx.a = scene;
      ctx.x = word(wram, SCENE_REQUEST_ARGUMENT);
    };
    if (scene !== SCENE_REQUEST_MATRIX)
      yield* dialogCallBody(
        h,
        CUTSCENE_SITE,
        PLAY_CUTSCENE,
        () => cutsceneSequence(h, events, MAIN_SCENE_ROUTINES),
        true,
      );
    else {
      yield* dialogCallBody(
        h,
        MATRIX_SITE,
        PLAY_MATRIX,
        () => matrixSceneSequence(h, events, MAIN_SCENE_ROUTINES),
        true,
      );
      yield () => {
        const record = word(wram, DECKER_RECORD);
        // A long store indexed by X: a record near FFFF reaches into bank 7F.
        wram[RECORD_COUNT + record] = wram[DECKER_HEALTH];
        ctx.x = record;
      };
    }
    yield () => setUpGameScreen(sceneRuntime(h), tasksOf(h.a));
  }
  let room;
  yield () => {
    setWord(wram, SCENE_REQUEST, SCENE_REQUEST_NONE);
    room = word(wram, ROOM);
    h.a.pushWord(ROOM_ENTRY_RETURN);
  };
  yield* enterRoomSequence(h, events, room);
  yield () => {
    h.a.pullWord();
    ctx.status |= FLAG_CARRY;
    result = h.rts();
  };
  return result;
}

// The run wrapper for the main loop's routine table.
export function processSceneRequest(h, events) {
  return drainNativeSequence(sceneRequestSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(SCENE_REQUEST_ENTRY, {
  run: processSceneRequest,
  create: ({ h, events }) => new NativeCallContinuation(h.a, sceneRequestSequence(h, events)),
});
