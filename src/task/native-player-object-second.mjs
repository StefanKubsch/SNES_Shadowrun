import { leaf } from './native-leaf-support.mjs';
import { PLAYER_OBJECT } from './wram.mjs';

// 80:D18A: a second, byte-identical ROM copy of getPlayerObject (80:CD97) with its own native ID.
export const getPlayerObjectCopy = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.result(h.load(h.longRead(h.abs(PLAYER_OBJECT))));
    },
    outerReturn,
  );
