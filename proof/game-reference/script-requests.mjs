// Register-level references of the scripts' room, scene and main loop requests (moved
// from src/script/native-room-change.mjs, native-scene-change.mjs, native-room-reload.mjs,
// native-main-loop-exit.mjs, native-dialog-end.mjs and native-player-control-reset.mjs;
// lifted in src/game/script-requests.mjs). The proof plans
// and the Native58 dispatch of proof/task/native-dispatch.mjs run these; the game runs
// the lifted natives.
import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  THIRD_ARGUMENT,
  leaf,
} from '../system/native-leaf-support.mjs';
import {
  AIMING_SPELL,
  AIMING_WEAPON,
  DIALOG_END,
  GROUP_LEADER_ONLY,
  PLAYER_HIT_FRAMES,
  PLAYER_IDLE,
  SCRIPT_GLOVE_CHOICE,
  MAIN_LOOP_EXIT,
  MAIN_LOOP_RELOAD,
  MAIN_LOOP_REQUESTED,
  ROOM,
  SCENE_REQUEST,
  SCENE_REQUEST_ARGUMENT,
  SCENE_REQUEST_ROOM_ONLY,
  WRAM,
} from '../../src/data/wram.mjs';
import { LONG_WRAP, WORD_MASK } from '../../src/constants/bits.mjs';

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
// 80:CDCF: end the running dialog or menu.
export const endDialogReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(DIALOG_END), h.load(WORD_MASK));
    },
    outerReturn,
  );
// 80:DE7E: reset the player control state on a scene change: PLAYER_IDLE becomes FFFF,
// aiming, hit frames, leader-only mode and the script glove choice become 0 (all at DBR).
export const resetPlayerControlReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(PLAYER_IDLE), h.load(WORD_MASK));
      for (const field of [
        AIMING_WEAPON,
        AIMING_SPELL,
        PLAYER_HIT_FRAMES,
        GROUP_LEADER_ONLY,
        SCRIPT_GLOVE_CHOICE,
      ])
        h.longWrite(h.abs(field), 0);
    },
    outerReturn,
  );
