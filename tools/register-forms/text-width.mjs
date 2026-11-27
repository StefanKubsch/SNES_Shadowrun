// The text width 80:FADD as the register form for register-level callers (moved from
// src/game/text-width.mjs): A the width (the direct page word BA) with its sign and
// zero, X the last tree index or table index, Y unchanged.
import { measure } from '../../src/game/text-width.mjs';
import { TEXT_WORK_WORD } from '../../src/data/wram.mjs';
import { BYTE_BITS, WORD_SIGN } from '../../src/constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};

export function measureTextWidthRoutine(h) {
  const { ctx } = h,
    { wram } = h.a.mem;
  ctx.x = measure(h, ctx.x);
  ctx.a = wram[TEXT_WORK_WORD] | (wram[TEXT_WORK_WORD + 1] << BYTE_BITS);
  flag(ctx, FLAG_NEGATIVE, ctx.a & WORD_SIGN);
  flag(ctx, FLAG_ZERO, ctx.a === 0);
  return h.rts();
}
