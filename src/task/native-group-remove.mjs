import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import {
  GROUP_INDEX,
  GROUP_NUMBERS,
  GROUP_OBJECTS,
  GROUP_POSITIONS,
  GROUP_SLOTS,
  WRAM,
} from './wram.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_MASK } from '../constants/bits.mjs';
// 80:A2B5: remove the member object (first argument) from the group. It is searched in
// the group slots from the last index down (empty group or a miss: nothing changes);
// the entries above it in the object, number, position and slot lists move down by one
// word until the last index, which then drops by one entry (two DECs).
export const removeGroupMember = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        compare = (left, right) => {
          h.nz((left - right) & WORD_MASK);
          ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
        };
      h.load(h.longRead(WRAM + GROUP_INDEX));
      if (ctx.status & FLAG_NEGATIVE) return;
      h.index('x', ctx.a);
      h.load(h.dp(FIRST_ARGUMENT));
      for (;;) {
        compare(ctx.a, h.longRead(h.abs(GROUP_SLOTS) + ctx.x));
        if (ctx.status & FLAG_ZERO) break;
        h.index('x', ctx.x - 2);
        if (ctx.status & FLAG_NEGATIVE) return;
      }
      do {
        for (const list of [WRAM + GROUP_OBJECTS, WRAM + GROUP_NUMBERS, WRAM + GROUP_POSITIONS]) {
          h.load(h.longRead(list + 2 + ctx.x));
          h.longWrite(list + ctx.x, ctx.a);
        }
        h.load(h.longRead(h.abs(GROUP_SLOTS + 2) + ctx.x));
        h.longWrite(h.abs(GROUP_SLOTS) + ctx.x, ctx.a);
        h.index('x', ctx.x + 2);
        h.load(ctx.x);
        compare(ctx.a, h.longRead(WRAM + GROUP_INDEX));
      } while (!(ctx.status & FLAG_CARRY));
      h.load(h.longRead(WRAM + GROUP_INDEX));
      h.load(ctx.a - 1);
      h.load(ctx.a - 1);
      h.longWrite(WRAM + GROUP_INDEX, ctx.a);
    },
    outerReturn,
  );
