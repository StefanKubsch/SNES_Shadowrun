// Register-level references of the party's karma, nuyen and magic point sums (moved from
// src/task/native-karma-add.mjs, native-nuyen-add.mjs and native-magic-points-add.mjs;
// lifted in src/game/party-funds.mjs). The proof plans, the Native58 dispatch of
// proof/task/native-dispatch.mjs and the instruction test of 80:8B8A run these; the game
// runs the lifted natives.
import { FIRST_ARGUMENT, leaf } from '../../src/task/native-leaf-support.mjs';
import { taskSelectionSupport } from '../../src/task/native-object-turn.mjs';
import { KARMA, MAGIC_POINTS, MEMBER_INDEX, NUYEN, WRAM } from '../../src/task/wram.mjs';
import { BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';

const NUYEN_LOW = WRAM + NUYEN,
  NUYEN_HIGH = NUYEN_LOW + 2,
  MAXIMUM_WORD = WORD_MASK;

// 80:CDB2: karma plus the first script argument, as a wrapping 16-bit sum without a limit.
export const addKarmaReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const karma = h.add(h.longRead(WRAM + KARMA), h.dp(FIRST_ARGUMENT));
      h.longWrite(WRAM + KARMA, karma);
    },
    outerReturn,
  );
// 80:CCDB: the 32-bit nuyen balance plus the first script argument. A carry
// increments the high word; if that wraps, both words saturate at the maximum.
export const addNuyenReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      let low = h.add(h.longRead(NUYEN_LOW), h.dp(FIRST_ARGUMENT));
      if (h.carried()) {
        h.longWrite(NUYEN_LOW, low);
        const high = h.load((h.longRead(NUYEN_HIGH) + 1) & WORD_MASK);
        h.longWrite(NUYEN_HIGH, high);
        if (high !== 0) return;
        // The ROM stores the wrapped high word before the saturated one.
        low = h.load(MAXIMUM_WORD);
        h.longWrite(NUYEN_HIGH, MAXIMUM_WORD);
      }
      h.longWrite(NUYEN_LOW, low);
    },
    outerReturn,
  );
// 80:8B8A: magic points of the selected team member plus the low byte of the
// first argument, as a wrapping one-byte sum without a limit (SEP #20, CLC, ADC).
export const addMagicPointsReference = (a, outerReturn = true) =>
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
