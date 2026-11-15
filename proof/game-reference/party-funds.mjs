// Register-level references of the party's karma, nuyen and magic point sums and its
// learned spells (moved from src/script/native-karma-add.mjs, native-nuyen-add.mjs,
// native-magic-points-add.mjs and native-spell-add.mjs;
// lifted in src/game/party-funds.mjs). The proof plans, the Native58 dispatch of
// proof/task/native-dispatch.mjs and the instruction test of 80:8B8A run these; the game
// runs the lifted natives.
import { FIRST_ARGUMENT, leaf } from '../../src/system/native-leaf-support.mjs';
import { taskSelectionSupport } from '../../src/script/native-object-turn.mjs';
import {
  KARMA,
  MAGIC_POINTS,
  MEMBER_INDEX,
  NUYEN,
  SPELL_LIST,
  WRAM,
} from '../../src/data/wram.mjs';
import { BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';

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
const END = 0,
  SPELL_BYTES = 2;
// 80:E1B3: add the spell (first argument) to the end of the learned spell list (words,
// 0 ends it) unless the list already holds it. The new end marker is written before
// the spell; the flags come from the last load or CMP.
export const learnSpellReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      let entry = h.index('x', 0);
      while (true) {
        const spell = h.load(h.longRead(WRAM + SPELL_LIST + entry));
        if (spell === END) {
          h.longWrite(WRAM + SPELL_LIST + SPELL_BYTES + entry, spell);
          h.longWrite(WRAM + SPELL_LIST + entry, h.load(h.dp(FIRST_ARGUMENT)));
          return;
        }
        // CMP DP00: carry when the entry >= the spell, N and Z from the difference.
        const wanted = h.dp(FIRST_ARGUMENT);
        h.nz((spell - wanted) & WORD_MASK);
        h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(spell >= wanted);
        if (h.ctx.status & FLAG_ZERO) return;
        h.index('x', (entry + 1) & WORD_MASK);
        entry = h.index('x', (entry + 2) & WORD_MASK);
      }
    },
    outerReturn,
  );
