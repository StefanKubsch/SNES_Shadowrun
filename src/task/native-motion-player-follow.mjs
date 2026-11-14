import { SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { startMotionToObject } from './native-motion-object-move.mjs';
import { MOTION_STRAIGHT, PLAYER_OBJECT } from './wram.mjs';
import { BANK_WRAP } from '../constants/bits.mjs';

// 80:C716: move the object (first argument) straight towards the player object (0CC2):
// the player object becomes the second argument, then the body of 80:C6F3 follows.
export const moveObjectStraightToPlayer = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const player = h.load(h.longRead(h.abs(PLAYER_OBJECT)));
      a.writeWord(SECOND_ARGUMENT, player, BANK_WRAP, 'leaf-reset-parameter');
      startMotionToObject(h, MOTION_STRAIGHT);
    },
    outerReturn,
  );
