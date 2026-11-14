import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { ROOM, SCENE_REQUEST, SCENE_REQUEST_ROOM_ONLY, WRAM } from './wram.mjs';

// 80:CC97: switch to the room in the first argument without a scene sequence.
export const changeRoom = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(WRAM + ROOM, h.load(h.dp(FIRST_ARGUMENT)));
      h.longWrite(h.abs(SCENE_REQUEST), h.load(SCENE_REQUEST_ROOM_ONLY));
    },
    outerReturn,
  );
