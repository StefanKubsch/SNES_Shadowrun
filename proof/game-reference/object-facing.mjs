// Register-level references of the facing natives 80:CF93 (turn towards another object),
// 80:D1D2 (turn towards the player object) and 80:D1DD (the direction towards the player
// object) with their direction body 80:D1E3, moved from src/script/native-object-face-object.mjs,
// native-player-direction-slot.mjs and native-player-direction.mjs; lifted in
// src/game/object-facing.mjs. The proof plans, the Native58 dispatch of
// proof/task/native-dispatch.mjs and the instruction tests run these; the game runs the
// lifted natives.
import { taskStop } from '../../src/system/task-stop.mjs';
import { FIRST_ARGUMENT, leaf } from '../system/native-leaf-support.mjs';
import {
  runTaskAction,
  taskSelectionSupport,
  DP_DISTANCE_X,
  DP_DISTANCE_Y,
  DP_MINUS_X,
  DP_MINUS_Y,
  FACING,
} from '../script/native-object-turn.mjs';
import { setObjectDirectionReference } from './object-turn.mjs';
import { OBJECT_X, OBJECT_Y, PLAYER_OBJECT } from '../../src/data/wram.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { BANK_WRAP, BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import '../system/dialog-register-helpers.mjs';

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
export const turnObjectToPlayerReference = (a, outerReturn = true) =>
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
const DIRECTION_RETURN_WORD = 0xd1df;

// 80:D1DD: return the direction from the object in the first argument towards the
// player object (0CC2), through 80:D1E3 with a real JSR frame (as in 80:D1D2); the
// result is the direction in Y.
export const getDirectionToPlayerReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const support = taskSelectionSupport(h);
      support.call(DIRECTION_RETURN_WORD, () => findDirectionToPlayer(h, support));
      a.writeWord(FIRST_ARGUMENT, h.ctx.y, BANK_WRAP, 'leaf-direction-STY');
    },
    outerReturn,
  );
// 80:CF93: the object (first argument) turns towards the object in the second argument
// (low byte FF: return with the CMP flags). Signed
// differences of 0E28/0E80 (target minus own) go to DPA2/DPA5 as magnitudes, negative raw values to
// DPA8/DPAB (else 0). One axis dominates when half the other is not below it; direction 0..7 to DP02
// (+dy 0, +dx 2, -dy 4, -dx 6, diagonals between; DP00 = X), then the proved AAAF with a real JSR/RTS.
const AAAF_RETURN_WORD = 0x80d014 & WORD_MASK;
export const turnObjectToObjectReference = (a, outerReturn = true) =>
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
      const result = setObjectDirectionReference(a, false);
      if (result.rawReturnWord !== AAAF_RETURN_WORD)
        taskStop('task_native_helper_return_required', {
          actual: result.rawReturnWord,
          expected: AAAF_RETURN_WORD,
        });
    },
    outerReturn,
  );
