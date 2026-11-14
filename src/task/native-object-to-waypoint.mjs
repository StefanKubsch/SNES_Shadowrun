import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import {
  MOTION_ACTIVE,
  WRAM,
  OBJECT_X,
  OBJECT_Y,
  OBJECT_HEIGHT,
  DP_POINT_LIST,
  DP_POINT_LIST_BANK,
} from './wram.mjs';
import { WORD_MASK, BANK_WRAP, WORD_BITS, LONG_WRAP, LONG_MASK } from '../constants/bits.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';

// 80:D105: place the object (first argument) on the waypoint (second argument) of the
// room's point list and stop its motion. The entry offset is 6 * waypoint as in
// startMotionToWaypoint (native-motion-waypoint-move.mjs); X, Y and height follow at
// entry + 1, + 3 and + 5 (INY twice between them), each stored times four. The long
// pointer DP F3..F5 is read fresh for each word.
export const placeObjectOnWaypoint = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(h.dp(SECOND_ARGUMENT));
      h.asl();
      h.asl();
      h.asl();
      h.ctx.status |= FLAG_CARRY;
      h.arithmetic(h.dp(SECOND_ARGUMENT), true);
      h.arithmetic(h.dp(SECOND_ARGUMENT), true);
      h.index('y', h.ctx.a);
      let entry = h.index('y', (h.ctx.y + 1) & WORD_MASK);
      for (const field of [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT]) {
        const pointer =
          a.readWord(DP_POINT_LIST, BANK_WRAP, 'position-fresh-pointer') |
          (a.read(DP_POINT_LIST_BANK, 'position-fresh-bank') << WORD_BITS);
        h.load(a.readWord((pointer + entry) & LONG_MASK, LONG_WRAP, 'position-indirect-WORD'));
        h.asl();
        h.asl();
        h.longWrite(h.abs(field) + object, h.ctx.a);
        if (field !== OBJECT_HEIGHT) {
          h.index('y', (entry + 1) & WORD_MASK);
          entry = h.index('y', (entry + 2) & WORD_MASK);
        }
      }
      h.longWrite(WRAM + MOTION_ACTIVE + object, h.load(0));
    },
    outerReturn,
  );
