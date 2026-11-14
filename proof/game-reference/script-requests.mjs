// Register-level references of the scripts' room, scene and main loop requests (moved
// from src/task/native-room-change.mjs, native-scene-change.mjs, native-room-reload.mjs
// and native-main-loop-exit.mjs; lifted in src/game/script-requests.mjs). The proof plans
// and the Native58 dispatch of proof/task/native-dispatch.mjs run these; the game runs
// the lifted natives.
import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  THIRD_ARGUMENT,
  leaf,
} from '../../src/task/native-leaf-support.mjs';
import {
  MAIN_LOOP_EXIT,
  MAIN_LOOP_RELOAD,
  MAIN_LOOP_REQUESTED,
  ROOM,
  SCENE_REQUEST,
  SCENE_REQUEST_ARGUMENT,
  SCENE_REQUEST_ROOM_ONLY,
  WRAM,
} from '../../src/task/wram.mjs';
import { LONG_WRAP } from '../../src/constants/bits.mjs';

// 80:CC97: switch to the room in the first argument without a scene sequence.
export const changeRoomReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(WRAM + ROOM, h.load(h.dp(FIRST_ARGUMENT)));
      h.longWrite(h.abs(SCENE_REQUEST), h.load(SCENE_REQUEST_ROOM_ONLY));
    },
    outerReturn,
  );
// 80:CC33: request the scene sequence (first argument) with its argument (second)
// and set the room (third argument).
export const changeSceneReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(SCENE_REQUEST), h.load(h.dp(FIRST_ARGUMENT)));
      h.longWrite(h.abs(SCENE_REQUEST_ARGUMENT), h.load(h.dp(SECOND_ARGUMENT)));
      h.longWrite(WRAM + ROOM, h.load(h.dp(THIRD_ARGUMENT)));
    },
    outerReturn,
  );
// 80:D016: ask the main loop to reload the current room.
export const requestRoomReloadReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(MAIN_LOOP_RELOAD), h.load(MAIN_LOOP_REQUESTED));
    },
    outerReturn,
  );
// 80:D9A0: ask the main loop to exit.
export const requestMainLoopExitReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      a.writeWord(h.abs(MAIN_LOOP_EXIT), h.load(MAIN_LOOP_REQUESTED), LONG_WRAP, 'leaf-reset-word');
    },
    outerReturn,
  );
