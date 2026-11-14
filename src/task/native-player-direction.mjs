import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { taskSelectionSupport } from './native-object-turn.mjs';
import { findDirectionToPlayer } from './native-player-direction-slot.mjs';
import { BANK_WRAP } from '../constants/bits.mjs';

const DIRECTION_RETURN_WORD = 0xd1df;

// 80:D1DD: return the direction from the object in the first argument towards the
// player object (0CC2), through 80:D1E3 with a real JSR frame (as in 80:D1D2); the
// result is the direction in Y.
export const getDirectionToPlayer = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const support = taskSelectionSupport(h);
      support.call(DIRECTION_RETURN_WORD, () => findDirectionToPlayer(h, support));
      a.writeWord(FIRST_ARGUMENT, h.ctx.y, BANK_WRAP, 'leaf-direction-STY');
    },
    outerReturn,
  );
