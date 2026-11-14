import { SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { startMotionToObject } from './native-motion-object-move.mjs';
import { PLAYER_OBJECT } from './wram.mjs';
import { BANK_WRAP } from '../constants/bits.mjs';

// 80:C71D: move the object (first argument) towards the player object (0CC2): the
// player object becomes the second argument, then BRA into the body of 80:C6F8.
export const moveObjectToPlayer = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const player = h.load(h.longRead(h.abs(PLAYER_OBJECT)));
      a.writeWord(SECOND_ARGUMENT, player, BANK_WRAP, 'c71d-DP02');
      startMotionToObject(h);
    },
    outerReturn,
  );
