import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { taskSelectionSupport } from './native-object-turn.mjs';
import { MAGIC_POINTS, MEMBER_INDEX, WRAM } from './wram.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';

// 80:8B8A: magic points of the selected team member plus the low byte of the
// first argument, as a wrapping one-byte sum without a limit (SEP #20, CLC, ADC).
export const addMagicPoints = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { byteArithmetic } = taskSelectionSupport(h),
        { ctx } = h;
      // The member index is stored doubled; LSR moves bit 0 into the carry.
      const doubledMember = h.load(h.longRead(h.abs(MEMBER_INDEX)));
      ctx.status = (ctx.status & ~FLAG_CARRY) | (doubledMember & 1);
      const member = h.index('x', h.load(doubledMember >>> 1)),
        address = WRAM + MAGIC_POINTS + member;
      ctx.status &= ~FLAG_CARRY;
      h.load(a.read(address, '8b8a-BYTE'), 1);
      byteArithmetic(a.read(FIRST_ARGUMENT, '8b8a-DP00-BYTE'), false);
      a.write(address, ctx.a & BYTE_MASK, '8b8a-BYTE');
    },
    outerReturn,
  );
