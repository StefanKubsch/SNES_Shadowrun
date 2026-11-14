import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { ROOM, SCENE_REQUEST, SCENE_REQUEST_ARGUMENT, WRAM } from './wram.mjs';

const THIRD_ARGUMENT = 4;

// 80:CC33: request the scene sequence (first argument) with its argument (second)
// and set the room (third argument).
export const changeScene = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(SCENE_REQUEST), h.load(h.dp(FIRST_ARGUMENT)));
      h.longWrite(h.abs(SCENE_REQUEST_ARGUMENT), h.load(h.dp(SECOND_ARGUMENT)));
      h.longWrite(WRAM + ROOM, h.load(h.dp(THIRD_ARGUMENT)));
    },
    outerReturn,
  );
