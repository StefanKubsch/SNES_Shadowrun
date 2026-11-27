import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The scene request of the main loop (lifted from 80:CC4B; register-level
// reference in proof/game-reference/scene-request.mjs).
//
// Script code asks for a new scene by writing the scene request word 7E:1CE9:
// FFFF asks for nothing, 7FFF for the room (7E:2DE2) only, FFFE for the matrix and
// any other value for that cutscene, with its argument in 7E:1CEB. A scene blanks
// the screen, waits for the frame and plays; after the matrix the decker's health
// goes back into the decker's record. Then the game screen is set up again and,
// as for a room only, the request is cleared and the room entered. The main loop
// starts its next pass at its top when the request was taken (the carry set in the
// original, a returned flag here).
//
// The forced blank 81:B0BD, the frame wait 81:B0A1 and the room entry 80:A4BF are
// the lifted ones of src/game/room-entry.mjs, the game screen set-up 80:9629 the one
// of src/game/game-screen.mjs. The cutscene 81:CDF8 and the matrix 81:C3CA are
// lifted scenes (src/cutscene, src/matrix). Scenes, the nested intro credits and
// room entry compose directly without CPU call frames.
//
// Registers (user decision 2026-11-17): game state only; the cutscene takes the scene
// and its argument as parameters and the routine leaves no A, X, Y or flags.
// The main loop runs it without its JSR frame. Its RTS form is sceneRequestJsr in
// tools/register-forms/jsr-forms.mjs; sceneRequestRoutineSequence in
// proof/caller/live-loop-routines.mjs is the register form for the routine table: the
// carry set when the request was taken.
import { tasksOf } from '../script/task-api.mjs';
import { playCutscene } from '../cutscene/cutscene-scene.mjs';
import { playMatrix } from '../matrix/matrix-scene.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { setUpGameScreen } from './game-screen.mjs';
import { enterRoomSequence, forceBlank } from './room-entry.mjs';
import { waitForCounterWord } from '../system/frame-wait.mjs';
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

const SCENE_REQUEST_NONE = WORD_MASK;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// 80:CC4B: compose the live scenes and room directly. request.taken reports whether a
// request was taken; the main caller restarts its pass after a transition.
export function* sceneRequestSequence(h, events, request = {}) {
  const { wram } = sceneRuntime(h);
  request.taken = word(wram, SCENE_REQUEST) !== SCENE_REQUEST_NONE;
  if (!request.taken) return;
  if (word(wram, SCENE_REQUEST) !== SCENE_REQUEST_ROOM_ONLY) {
    yield () => forceBlank(wram);
    yield* waitForCounterWord(h, events);
    // The scene takes the request, read again after the wait, and its argument.
    let scene, argument;
    yield () => {
      scene = word(wram, SCENE_REQUEST);
      argument = word(wram, SCENE_REQUEST_ARGUMENT);
    };
    if (scene !== SCENE_REQUEST_MATRIX) yield* playCutscene(h, events, scene, argument);
    else {
      yield* playMatrix(h, events);
      yield () => {
        const record = word(wram, DECKER_RECORD);
        // A long store indexed by X: a record near FFFF reaches into bank 7F.
        writeStateByte(wram, RECORD_COUNT + record, readStateByte(wram, DECKER_HEALTH));
      };
    }
    yield () => setUpGameScreen(sceneRuntime(h), tasksOf(h.a));
  }
  let room;
  yield () => {
    setWord(wram, SCENE_REQUEST, SCENE_REQUEST_NONE);
    room = word(wram, ROOM);
  };
  yield* enterRoomSequence(h, events, room);
}
