import { taskStop } from './plan.mjs';
import { leaf } from './native-leaf-support.mjs';
import { setObjectDirection } from './native-object-action-set.mjs';
import {
  DP_DISTANCE_X,
  DP_DISTANCE_Y,
  DP_MINUS_X,
  DP_MINUS_Y,
  FACING,
} from './native-object-turn.mjs';
import { OBJECT_X, OBJECT_Y } from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
import { BANK_WRAP, WORD_MASK, BYTE_MASK } from '../constants/bits.mjs';
// 80:CF93: the object (first argument) turns towards the object in the second argument
// (low byte FF: return with the CMP flags). Signed
// differences of 0E28/0E80 (target minus own) go to DPA2/DPA5 as magnitudes, negative raw values to
// DPA8/DPAB (else 0). One axis dominates when half the other is not below it; direction 0..7 to DP02
// (+dy 0, +dx 2, -dy 4, -dx 6, diagonals between; DP00 = X), then the proved AAAF with a real JSR/RTS.
const AAAF_RETURN_WORD = 0x80d014 & WORD_MASK;
export const turnObjectToObject = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        store = (offset, value) => a.writeWord(offset, value, BANK_WRAP, 'CF93-DP-WORD');
      const compare = (left, right) => {
        h.nz((left - right) & WORD_MASK);
        ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
      };
      h.load(h.dp(2));
      h.load(ctx.a & BYTE_MASK);
      compare(ctx.a, BYTE_MASK);
      if (ctx.status & FLAG_ZERO) return;
      h.index('x', h.dp(0));
      h.index('y', h.dp(2));
      store(DP_MINUS_X, 0);
      store(DP_MINUS_Y, 0);
      const distance = (table, sign, magnitude) => {
        h.load(h.longRead(h.abs(table) + ctx.y));
        ctx.status |= FLAG_CARRY;
        h.arithmetic(h.longRead(h.abs(table) + ctx.x), true);
        if (ctx.status & FLAG_NEGATIVE) {
          store(sign, ctx.a);
          h.load(ctx.a ^ WORD_MASK);
          h.load((ctx.a + 1) & WORD_MASK);
        }
        store(magnitude, ctx.a);
      };
      distance(OBJECT_X, DP_MINUS_X, DP_DISTANCE_X);
      distance(OBJECT_Y, DP_MINUS_Y, DP_DISTANCE_Y);
      const half = (offset) => {
        h.load(h.dp(offset));
        ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
        h.load(ctx.a >>> 1);
      };
      const pick = (offset, set, clear) => {
        h.load(h.dp(offset));
        if (ctx.status & FLAG_ZERO) return clear();
        h.index('y', set);
      };
      half(DP_DISTANCE_Y);
      compare(ctx.a, h.dp(DP_DISTANCE_X));
      if (ctx.status & FLAG_CARRY) pick(DP_MINUS_Y, FACING.minusY, () => h.index('y', ctx.a));
      else {
        half(DP_DISTANCE_X);
        compare(ctx.a, h.dp(DP_DISTANCE_Y));
        if (ctx.status & FLAG_CARRY) pick(DP_MINUS_X, FACING.minusX, () => h.index('y', FACING.x));
        else {
          h.load(h.dp(DP_MINUS_X));
          if (ctx.status & FLAG_ZERO)
            pick(DP_MINUS_Y, FACING.xMinusY, () => h.index('y', FACING.xy));
          else pick(DP_MINUS_Y, FACING.minusXMinusY, () => h.index('y', FACING.minusXY));
        }
      }
      store(0, ctx.x);
      store(2, ctx.y);
      a.pushWord(AAAF_RETURN_WORD, 'CF93-JSR-AAAF');
      const result = setObjectDirection(a, false);
      if (result.rawReturnWord !== AAAF_RETURN_WORD)
        taskStop('task_native_helper_return_required', {
          actual: result.rawReturnWord,
          expected: AAAF_RETURN_WORD,
        });
    },
    outerReturn,
  );
