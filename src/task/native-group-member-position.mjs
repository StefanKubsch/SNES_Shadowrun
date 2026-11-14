import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { GROUP_INDEX, GROUP_POSITIONS, GROUP_SLOTS, WRAM } from './wram.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_MASK, BANK_WRAP } from '../constants/bits.mjs';

const MEMBER_BYTES = 2;

// 80:A297: return the group position of the member object (first argument), searched
// in the group slots from the last index down; 0 for an empty group or a miss (STZ).
export const getGroupMemberPosition = (a, outerReturn = true) =>
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
