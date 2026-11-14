import { leaf } from './native-leaf-support.mjs';
import { PLAYER_OBJECT } from './wram.mjs';

// 80:CD97: return the object slot of the player figure (the leader).
export const getPlayerObject = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.result(h.load(h.longRead(h.abs(PLAYER_OBJECT))));
    },
    outerReturn,
  );
