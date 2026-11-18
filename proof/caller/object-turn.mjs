// The object turn 80:AAAF as register-level callers call it with JSR (moved from
// src/game/object-turn.mjs, whose lifted callers use turnObjectJsr and turnObjectCall
// and read no registers).
import { turnObject } from '../../src/game/object-turn.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';
import { WORD_SIGN } from '../../src/constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_DECIMAL,
  FLAG_NEGATIVE,
  FLAG_OVERFLOW,
  FLAG_ZERO,
} from '../../src/constants/cpu-flags.mjs';

const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};

// The turn as called with JSR (80:AAAF), its return word on the stack: direct page 0
// and binary arithmetic. Leaves A, X, Y and the flags as the original and returns
// with its RTS.
export function turnObjectRoutine(h) {
  const { ctx, a } = h;
  if (ctx.d !== 0) taskStop('task_direct_page_zero_required');
  if (ctx.status & FLAG_DECIMAL) taskStop('task_binary_arithmetic_required');
  const { mem } = a,
    left = turnObject(mem, mem.wram, a);
  if (left.a !== undefined) ctx.a = left.a;
  ctx.x = left.x;
  ctx.y = left.y;
  flag(ctx, FLAG_NEGATIVE, left.sign & WORD_SIGN);
  flag(ctx, FLAG_ZERO, left.sign === 0);
  flag(ctx, FLAG_CARRY, left.carry);
  if (left.overflow !== undefined) flag(ctx, FLAG_OVERFLOW, left.overflow);
  return h.rts();
}
