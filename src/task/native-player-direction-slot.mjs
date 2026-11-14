import { leaf } from './native-leaf-support.mjs';
import {
  runTaskAction,
  taskSelectionSupport,
  DP_DISTANCE_X,
  DP_DISTANCE_Y,
  DP_MINUS_X,
  DP_MINUS_Y,
  FACING,
} from './native-object-turn.mjs';

import { OBJECT_X, OBJECT_Y, PLAYER_OBJECT } from './wram.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { BANK_WRAP, WORD_MASK } from '../constants/bits.mjs';
// 80:D1E3: direction (0..7, in Y) from the object (first argument, X) towards the player
// object (0CC2): the differences player minus object as wrapped word differences, BPL
// and unsigned half-distance comparisons. No coordinate or caller is inferred.
// Return word of a JSR: the bank offset of the call's last byte.
const callReturn = (address) => address & WORD_MASK;
export function findDirectionToPlayer(h, k) {
  const { a, ctx } = h;
  const store = (offset, value) => a.writeWord(offset, value, BANK_WRAP, '6c-direction-DP');
  const half = () => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
    h.load(ctx.a >>> 1);
  };
  h.index('x', h.dp(0));
  h.index('y', h.longRead(h.abs(PLAYER_OBJECT)));
  store(DP_MINUS_X, 0);
  store(DP_MINUS_Y, 0);
  for (const [field, sign, magnitude] of [
    [OBJECT_X, DP_MINUS_X, DP_DISTANCE_X],
    [OBJECT_Y, DP_MINUS_Y, DP_DISTANCE_Y],
  ]) {
    h.load(h.longRead(h.abs(field) + ctx.y));
    ctx.status |= FLAG_CARRY;
    h.arithmetic(h.longRead(h.abs(field) + ctx.x), true);
    if (ctx.status & FLAG_NEGATIVE) {
      store(sign, ctx.a);
      h.load(ctx.a ^ WORD_MASK);
      h.load((ctx.a + 1) & WORD_MASK);
    }
    store(magnitude, ctx.a);
  }
  h.load(h.dp(DP_DISTANCE_Y));
  half();
  k.compare(ctx.a, h.dp(DP_DISTANCE_X));
  if (ctx.status & FLAG_CARRY) {
    h.load(h.dp(DP_MINUS_Y));
    if (!(ctx.status & FLAG_ZERO)) h.index('y', FACING.minusY);
    else h.index('y', ctx.a);
    return;
  }
  h.load(h.dp(DP_DISTANCE_X));
  half();
  k.compare(ctx.a, h.dp(DP_DISTANCE_Y));
  if (ctx.status & FLAG_CARRY) {
    h.load(h.dp(DP_MINUS_X));
    h.index('y', ctx.status & FLAG_ZERO ? FACING.x : FACING.minusX);
    return;
  }
  h.load(h.dp(DP_MINUS_X));
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(h.dp(DP_MINUS_Y));
    h.index('y', ctx.status & FLAG_ZERO ? FACING.minusXY : FACING.minusXMinusY);
  } else {
    h.load(h.dp(DP_MINUS_Y));
    h.index('y', ctx.status & FLAG_ZERO ? FACING.xy : FACING.xMinusY);
  }
}
// 80:D1D2: turn the object (first argument) towards the player object: JSR D1E3, the
// object to DP00 (STX) and the direction to DP02 (STY), then JSR AAAF (setObjectDirection).
export const turnObjectToPlayer = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const k = taskSelectionSupport(h);
      k.call(callReturn(0x80d1d4), () => findDirectionToPlayer(h, k));
      a.writeWord(0, h.ctx.x, BANK_WRAP, '6c-actual-slot-STX');
      a.writeWord(2, h.ctx.y, BANK_WRAP, '6c-actual-direction-STY');
      k.call(callReturn(0x80d1db), () => runTaskAction(h, k));
    },
    outerReturn,
  );
