// A blast (lifted from the script native 80:8E36; register-level version in
// src/task/native-object-hit.mjs, which recorded waits and inputs replay).
//
// The blast's centre is the object DP 00, its damage DP 02 (kept in DP A2 and A5). Every
// object slot from the last down to 0 is hit (80:8691 with the damage, no shooter) when
// it holds an object that can be hit (flag bit 15) and lies less than 60 from the centre
// on each axis: X, Y and height. The hit runs through its frame from the routine table,
// with its own callees.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import {
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_HITTABLE,
  OBJECT_KIND,
  OBJECT_LAST_SLOT,
  OBJECT_X,
  OBJECT_Y,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// The centre and damage in the direct page, the reach on each axis, the hit and its
// call site.
const DP_BLAST_CENTRE = 0xa2,
  DP_BLAST_DAMAGE = 0xa5,
  BLAST_REACH = 0x60,
  HIT = 0x808691,
  HIT_CALL = 0x808e8c,
  // The hit gets no shooter.
  NO_SHOOTER = WORD_MASK;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const setFlag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const setSignZero = (ctx, value) => {
  setFlag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  setFlag(ctx, FLAG_ZERO, value === 0);
};
const load = (ctx, value) => {
  ctx.a = value;
  setSignZero(ctx, value);
};

// Whether the blast reaches the slot: an object that can be hit within reach on each
// axis. Leaves A and, on the distance tests, the carry of the reach compare and the
// overflow of the subtraction, as the original's tests do.
function blastReaches(h, centre, slot) {
  const { ctx } = h,
    { mem } = h.a,
    kind = word(mem.wram, OBJECT_KIND + slot);
  load(ctx, kind);
  if (kind & WORD_SIGN) return false;
  const hittable = dataBankWord(mem, OBJECT_FLAGS, slot) & OBJECT_HITTABLE;
  load(ctx, hittable);
  if (!hittable) return false;
  for (const offset of [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT]) {
    const left = dataBankWord(mem, offset, slot),
      right = dataBankWord(mem, offset, centre),
      difference = (left - right) & WORD_MASK,
      distance = difference & WORD_SIGN ? -difference & WORD_MASK : difference,
      far = distance >= BLAST_REACH;
    setFlag(ctx, FLAG_OVERFLOW, (left ^ right) & (left ^ difference) & WORD_SIGN);
    // The sign and zero of the distance and its compare are always overwritten.
    ctx.a = distance;
    setFlag(ctx, FLAG_CARRY, far);
    if (far) return false;
  }
  return true;
}

// 80:8E36: hit every object the blast around DP 00 reaches with the damage DP 02. A
// sequence that ends with the native's RTS.
export function* hitObjectsInBlastSequence(h, events, routines) {
  const { ctx } = h,
    { wram } = h.a.mem,
    centre = word(wram, 0);
  yield () => {
    ctx.y = centre;
    setWord(wram, DP_BLAST_CENTRE, centre);
    setWord(wram, DP_BLAST_DAMAGE, word(wram, 2));
  };
  for (let slot = OBJECT_LAST_SLOT; slot >= 0; slot -= 2) {
    let reached;
    yield () => {
      reached = blastReaches(h, centre, slot);
    };
    if (reached) {
      yield () => {
        ctx.x = slot;
        load(ctx, word(wram, DP_BLAST_DAMAGE));
        ctx.y = NO_SHOOTER;
        setSignZero(ctx, NO_SHOOTER);
      };
      yield* nativeCallSequence(h, events, routines, HIT_CALL, HIT, false, false);
      yield () => {
        ctx.y = centre;
      };
    }
    yield () => {
      ctx.x = (slot - 2) & WORD_MASK;
      setSignZero(ctx, ctx.x);
    };
  }
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
