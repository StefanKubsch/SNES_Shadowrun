// Register-level references of the group member script natives 80:A297 and 80:A2B5
// (moved from src/task/native-group-member-position.mjs and native-group-remove.mjs;
// lifted in src/game/group-members.mjs). The proof plans, the Native58 dispatch of
// proof/task/native-dispatch.mjs and the instruction tests of 80:A297 and 80:A2B5 run
// them; the game runs the lifted natives.
import { FIRST_ARGUMENT, leaf } from '../../src/task/native-leaf-support.mjs';
import {
  GROUP_INDEX,
  GROUP_NUMBERS,
  GROUP_OBJECTS,
  GROUP_POSITIONS,
  GROUP_SLOTS,
  WRAM,
} from '../../src/task/wram.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { WORD_MASK, BANK_WRAP } from '../../src/constants/bits.mjs';

const MEMBER_BYTES = 2;
// 80:A297: return the group position of the member object (first argument), searched
// in the group slots from the last index down; 0 for an empty group or a miss (STZ).
export const getGroupMemberPositionReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h;
      const last = h.load(h.longRead(WRAM + GROUP_INDEX));
      if (!(ctx.status & FLAG_NEGATIVE)) {
        let member = h.index('x', last);
        const object = h.load(h.dp(FIRST_ARGUMENT));
        for (;;) {
          // CMP: carry when object >= slot, N and Z from the difference.
          const slot = h.longRead(h.abs(GROUP_SLOTS) + member);
          h.nz((object - slot) & WORD_MASK);
          ctx.status = (ctx.status & ~FLAG_CARRY) | Number(object >= slot);
          if (ctx.status & FLAG_ZERO) {
            const position = h.load(h.longRead(WRAM + GROUP_POSITIONS + member));
            a.writeWord(FIRST_ARGUMENT, position, BANK_WRAP, 'a297-DP00');
            return;
          }
          member = h.index('x', member - MEMBER_BYTES);
          if (ctx.status & FLAG_NEGATIVE) break;
        }
      }
      a.writeWord(FIRST_ARGUMENT, 0, BANK_WRAP, 'a297-STZ-DP00');
    },
    outerReturn,
  );
// 80:A2B5: remove the member object (first argument) from the group. It is searched in
// the group slots from the last index down (empty group or a miss: nothing changes);
// the entries above it in the object, number, position and slot lists move down by one
// word until the last index, which then drops by one entry (two DECs).
export const removeGroupMemberReference = (a, outerReturn = true) =>
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
