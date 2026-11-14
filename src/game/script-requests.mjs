// The scripts' requests to the main loop (lifted from the script natives 80:CC97, 80:CC33,
// 80:D016 and 80:D9A0; register-level references in
// proof/game-reference/script-requests.mjs).
//
// A script changes the room (7E:2DE2) with the scene request 7FFF (room only), or asks for
// a scene sequence with its argument and the room to enter afterwards (the request words
// 7E:1CE9 and 7E:1CEB, src/game/scene-request.mjs). It asks the main loop to reload the
// room (7E:1FD8) or to exit (7E:1FDA) by setting that word to FFFF. The request words lie
// in the low WRAM the data bank 80 mirrors; the room is written in bank 7E.
import { setDataBankWord } from '../system/data-bank.mjs';
import {
  MAIN_LOOP_EXIT,
  MAIN_LOOP_RELOAD,
  MAIN_LOOP_REQUESTED,
  ROOM,
  SCENE_REQUEST,
  SCENE_REQUEST_ARGUMENT,
  SCENE_REQUEST_ROOM_ONLY,
  WRAM,
} from '../task/wram.mjs';

// 80:CC97: enter the room without a scene sequence.
export function requestRoomChange(mem, room) {
  mem.write16(WRAM + ROOM, room);
  setDataBankWord(mem, SCENE_REQUEST, 0, SCENE_REQUEST_ROOM_ONLY);
}
// 80:CC33: play the scene sequence with its argument, then enter the room.
export function requestScene(mem, scene, argument, room) {
  setDataBankWord(mem, SCENE_REQUEST, 0, scene);
  setDataBankWord(mem, SCENE_REQUEST_ARGUMENT, 0, argument);
  mem.write16(WRAM + ROOM, room);
}
// 80:D016: reload the current room.
export const requestRoomReload = (mem) =>
  setDataBankWord(mem, MAIN_LOOP_RELOAD, 0, MAIN_LOOP_REQUESTED);
// 80:D9A0: leave the main loop.
export const requestMainLoopExit = (mem) =>
  setDataBankWord(mem, MAIN_LOOP_EXIT, 0, MAIN_LOOP_REQUESTED);
