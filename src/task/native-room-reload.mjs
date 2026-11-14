import { leaf } from './native-leaf-support.mjs';
import { MAIN_LOOP_RELOAD, MAIN_LOOP_REQUESTED } from './wram.mjs';

// 80:D016: ask the main loop to reload the current room.
export const requestRoomReload = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(MAIN_LOOP_RELOAD), h.load(MAIN_LOOP_REQUESTED));
    },
    outerReturn,
  );
