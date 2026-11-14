import { withInterruptEvents } from './observed-native-events.mjs';
import { taskStop } from './plan.mjs';
import { leaf } from './native-leaf-support.mjs';
import { testLineOfSight, SIGHT_ROUTINE } from './line-of-sight.mjs';
import { randomBelow } from './native-random.mjs';
import { createObject } from './native-object-create.mjs';
import { setObjectDirection } from './native-object-action-set.mjs';
import { hitObject, DP_HIT_RESULT, DP_HIT_SHOOTER } from './native-object-hit.mjs';
import { playSoundEffect } from './native-audio-compose.mjs';
import { validateTaskActionsOptions } from './native-actions.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { drainNativeSequence } from './native-call-continuation.mjs';

import {
  DP_OBJECT_HEIGHT,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  DP_SOUND_EFFECT,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  OBJECT_ARMOUR,
  OBJECT_ATTACKED,
  OBJECT_DIRECTION,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_NUMBER,
  OBJECT_X,
  OBJECT_Y,
  PLAYER_OBJECT,
  RUNNER_WEAPON_KIND,
  RUNNER_WEAPON_RANGE,
  WRAM,
  OBJECT_BOX_HEIGHT,
} from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
import {
  BANK_WRAP,
  WORD_MASK,
  LONG_WRAP,
  LONG_MASK,
  WORD_BITS,
  BYTE_MASK,
  HIGH_BYTE_MASK,
  BYTE_SIGN,
  BANK_SIZE,
} from '../constants/bits.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
// Return word of a JSR/JSL frame: the bank offset of the call's last byte.
const callReturn = (address) => address & WORD_MASK;
// Shot parameters of 8AB5 (DP04 hit bonus, DP06 kind, DP08 damage, DP0A range penalty) and
// their working copies: the bonus of the close kinds (also lowered by 8A43), of kind 5 and
// of the ranged kinds, the weapon kind, damage and signed range penalty.
export const DP_SHOT_BONUS = 4,
  DP_SHOT_KIND = 6,
  DP_SHOT_DAMAGE = 8,
  DP_SHOT_PENALTY = 0x0a,
  DP_BONUS_CLOSE = 0xab,
  DP_BONUS_KIND_5 = 0xae,
  DP_BONUS_RANGED = 0xb1,
  DP_WEAPON_KIND = 0xa2,
  DP_WEAPON_DAMAGE = 0xa5,
  DP_WEAPON_PENALTY = 0xa8;
// 8904: kinds below 4 and kind 6 roll without a range check; kind 5 adds half its bonus to
// the damage. The roll draws C51F below 8; the ranged kinds miss from 40 on any axis.
export const CLOSE_KIND_LIMIT = 4,
  CLOSE_KIND = 6,
  DAMAGE_BONUS_KIND = 5,
  HIT_ROLL_SIDES = 8,
  HIT_ROLL_OFFSET = 2,
  DAMAGE_BONUS_ROLL_OFFSET = 3,
  RANGED_REACH = 0x40;
// 8497: sign flags and magnitudes of the target offset; the eight facings by the signs of
// the dominant axis or of both axes (minus: target coordinate below the shooter's).
export const DP_MINUS_X = 0xc0,
  DP_MINUS_Y = 0xc3,
  DP_OFFSET_X = 0xba,
  DP_OFFSET_Y = 0xbd,
  FACING = Object.freeze({
    y: 0,
    xy: 1,
    x: 2,
    xMinusY: 3,
    minusY: 4,
    minusXMinusY: 5,
    minusX: 6,
    minusXY: 7,
  });
// 89B0: a miss places object E6 (script 80) at a random spot near the target: height below
// (box height + 0A) * 4 above the target, one of eight offsets of the tables 80:8A23/8A33,
// facing from 80:8A13 by the shooter's direction.
export const MISS_KIND = 0xe6,
  MISS_SCRIPT = 0x80,
  MISS_HEIGHT_RAISE = 0x0a,
  MISS_SPOTS = 8,
  MISS_OFFSETS_X = 0x8a23,
  MISS_OFFSETS_Y = 0x8a33,
  MISS_FACINGS = 0x8a13;
// 8860: the weapon owners 80:9700 (13 words, searched from X = 1A down), the record pointers
// 80:971A/9734 with the bonus bytes 6 (close), 7 (kind 5) and 8 (ranged, halved and rounded
// up). Shot sounds C, 40 and E for the kinds 0, 1 and 6, played by 88EB at level FF on
// voices FF.
export const WEAPON_OWNERS = 0x9700,
  WEAPON_OWNERS_END = 0x1a,
  WEAPON_RECORDS = 0x971a,
  WEAPON_RECORD_BANKS = 0x9734,
  DP_WEAPON_RECORD = 0xab,
  DP_WEAPON_RECORD_BANK = 0xad,
  RECORD_BONUS_CLOSE = 6,
  RECORD_BONUS_KIND_5 = 7,
  RECORD_BONUS_RANGED = 8,
  WEAPON_DAMAGE = RUNNER_WEAPON_KIND + 1,
  WEAPON_SEARCH_LIMIT = BANK_SIZE / 2,
  SHOT_SOUND_KIND_0 = 0x0c,
  SHOT_SOUND_KIND_1 = 0x40,
  SHOT_SOUND_KIND_6 = 0x0e,
  SHOT_SOUND_LEVEL_VOICES = BYTE_MASK;
// 80:8AB5: object DP00 shoots at object DP02 (parameters DP04 hit bonus, DP06 kind, DP08
// damage, DP0A range penalty). Fixed equations of the own code 8AB5/8A43/8497/8904 (source:
// tools/task-native-8ab5-source.mjs); calls into proved routines run their modules with real
// JSR/JSL frames: sight 81:A25F, random C51F, slot A835, action AAAF and the hit 8691
// (src/task/native-object-hit.mjs: damage, 8778 notices with waits and key input, 881C player hit with
// C46E and 81:AD92). Result in DP00: DPB4 (0, FFFF after a kill flag, 1 after a notice), FFFF when
// the sight is blocked. Waits and key input are observations ({waitMode, waitObservations,
// inputMode, inputObservations} like the other special natives).
// 80:8A51 (the player shoots at the object under the glove) and 80:8A8C (object shoots at
// object) share 8A43, 8904 (8A8C also 8497) and take their parameters from the weapon of the shooter
// (8860 with the shot sound 88EB/C46E; source: native8A51Spec/native8A8CSpec in the same source file).
// Proved routines called by 8AB5, 8A51 and 8A8C (sound C46E only from 8860). Tests may pass a replacement for a routine with its own proof.
// The sight 81:A25F receives the leaf access with its JSL frame pushed and returns with its RTL.
export const NATIVE_8AB5_ROUTINES = Object.freeze({
  sight: (h) => testLineOfSight(h),
  random: (a) => randomBelow(a, false),
  slot: (a) => createObject(a, false),
  action: (a) => setObjectDirection(a, false),
  hit: (a, events) => hitObject(a, events, false),
  sound: (a, events) => playSoundEffect(a, events, false),
});

// Own code shared by 8AB5, 8A51 and 8A8C (h from leaf, same JSR frames in all three).
function shooterParts(h, events, routines) {
  const { a, ctx } = h;
  const dp = (n) => h.dp(n),
    st = (n, v = ctx.a) => a.writeWord(n, v, BANK_WRAP, '8ab5-DP-WORD');
  const field = (offset, index) => h.longRead(h.abs(offset) + index);
  const sec = () => {
      ctx.status |= FLAG_CARRY;
    },
    clc = () => {
      ctx.status &= ~FLAG_CARRY;
    };
  const carry = () => (ctx.status & FLAG_CARRY) !== 0,
    zero = () => (ctx.status & FLAG_ZERO) !== 0,
    negative = () => (ctx.status & FLAG_NEGATIVE) !== 0;
  const lsr = () => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
    h.load(ctx.a >>> 1);
  };
  const adc = (v) => h.arithmetic(v),
    sbc = (v) => h.arithmetic(v, true);
  const compare = (left, right) => {
    h.nz((left - right) & WORD_MASK);
    ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
  };
  const negate = () => {
    h.load(ctx.a ^ WORD_MASK);
    h.load((ctx.a + 1) & WORD_MASK);
  };
  const push = (v, label) => a.pushWord(v, label),
    pull = (label) => a.pullWord(label);
  // Own subroutine: JSR frame on the stack, RTS takes it back.
  const inline = (returnWord, run) => {
    push(returnWord, '8ab5-JSR');
    run();
    const raw = pull('8ab5-RTS');
    if (raw !== returnWord)
      taskStop('task_native_helper_return_required', { actual: raw, expected: returnWord });
  };
  // Proved routine: JSR frame, the module returns through it.
  const module = (returnWord, run) => {
    push(returnWord, '8ab5-JSR');
    const result = run();
    if (result.rawReturnWord !== returnWord)
      taskStop('task_native_helper_return_required', {
        actual: result.rawReturnWord,
        expected: returnWord,
      });
  };
  // JSL 81:A25F (Y shooter, X target): carry set = sight blocked.
  const sight = (returnWord) => {
    a.write(ctx.s, ctx.programBank, '8ab5-JSL-bank');
    ctx.s = (ctx.s - 1) & WORD_MASK;
    push(returnWord, '8ab5-JSL-WORD');
    ctx.programBank = SIGHT_ROUTINE >>> WORD_BITS;
    ctx.pc = SIGHT_ROUTINE & WORD_MASK;
    const result = routines.sight(h);
    if (result.rawReturnWord !== returnWord || ctx.programBank !== CODE_BANK)
      taskStop('task_native_long_return_required', {
        raw: result.rawReturnWord,
        bank: ctx.programBank,
      });
  };
  const random = (returnWord) => module(returnWord, () => routines.random(a));
  const slot = (returnWord) => module(returnWord, () => routines.slot(a));

  // 8497: facing of the shooter Y towards the target X (eight directions), AAAF with DP00/DP02.
  const facing = () => {
    push(ctx.x, '8497-PHX');
    push(ctx.y, '8497-PHY');
    st(DP_MINUS_X, 0);
    st(DP_MINUS_Y, 0);
    sec();
    h.load(field(OBJECT_Y, ctx.x));
    sbc(field(OBJECT_Y, ctx.y));
    if (negative()) {
      st(DP_MINUS_Y);
      negate();
    }
    st(DP_OFFSET_Y);
    sec();
    h.load(field(OBJECT_X, ctx.x));
    sbc(field(OBJECT_X, ctx.y));
    if (negative()) {
      st(DP_MINUS_X);
      negate();
    }
    st(DP_OFFSET_X);
    h.load(dp(DP_OFFSET_Y));
    lsr();
    compare(ctx.a, dp(DP_OFFSET_X));
    let direction;
    if (carry()) {
      h.load(dp(DP_MINUS_Y));
      direction = zero() ? FACING.y : FACING.minusY;
    } else {
      h.load(dp(DP_OFFSET_X));
      lsr();
      compare(ctx.a, dp(DP_OFFSET_Y));
      if (carry()) {
        h.load(dp(DP_MINUS_X));
        direction = zero() ? FACING.x : FACING.minusX;
      } else {
        h.load(dp(DP_MINUS_X));
        const right = zero();
        h.load(dp(DP_MINUS_Y));
        direction = right
          ? zero()
            ? FACING.xy
            : FACING.xMinusY
          : zero()
            ? FACING.minusXY
            : FACING.minusXMinusY;
      }
    }
    h.index('x', direction);
    st(0, ctx.y);
    st(2, ctx.x);
    module(callReturn(0x80850d), () => routines.action(a));
    h.index('y', pull('8497-PLY'));
    h.index('x', pull('8497-PLX'));
  };

  // 89B0: miss: object E6 near the target with random offset (tables 8A23/8A33) and kind 8A13.
  const miss = () => {
    st(DP_HIT_SHOOTER, ctx.y);
    clc();
    h.load(h.longRead(WRAM + OBJECT_BOX_HEIGHT + ctx.x));
    adc(MISS_HEIGHT_RAISE);
    h.asl();
    h.asl();
    st(0);
    push(ctx.x, '89BE-PHX');
    push(ctx.y, '89BF-PHY');
    random(callReturn(0x8089c2));
    h.index('y', pull('89C3-PLY'));
    h.index('x', pull('89C4-PLX'));
    clc();
    h.load(dp(0));
    adc(field(OBJECT_HEIGHT, ctx.x));
    lsr();
    lsr();
    st(DP_OBJECT_HEIGHT);
    h.load(MISS_SPOTS);
    st(0);
    push(ctx.x, '89D4-PHX');
    random(callReturn(0x8089d7));
    h.index('x', pull('89D8-PLX'));
    h.load(dp(0));
    h.asl();
    h.index('y', ctx.a);
    h.load(field(OBJECT_X, ctx.x));
    lsr();
    lsr();
    clc();
    adc(field(MISS_OFFSETS_X, ctx.y));
    st(DP_OBJECT_X);
    h.load(field(OBJECT_Y, ctx.x));
    lsr();
    lsr();
    clc();
    adc(field(MISS_OFFSETS_Y, ctx.y));
    st(DP_OBJECT_Y);
    h.index('x', dp(DP_HIT_SHOOTER));
    h.load(field(OBJECT_DIRECTION, ctx.x));
    h.asl();
    h.index('x', ctx.a);
    h.load(field(MISS_FACINGS, ctx.y));
    push(ctx.a, '89FD-PHA');
    h.load(MISS_SCRIPT);
    st(DP_OBJECT_SCRIPT);
    h.load(MISS_KIND);
    st(DP_OBJECT_KIND);
    slot(callReturn(0x808a0a));
    h.index('x', dp(0));
    h.load(pull('8A0D-PLA'));
    h.longWrite(WRAM + OBJECT_ARMOUR + ctx.x, ctx.a);
  };

  // 8904: hit roll. Kinds below 4 and 6 use DPAB, 5 uses DPAE (and adds DPAE/2 to the damage),
  // the others DPB1; kinds 4, 5 and 7+ miss beyond 40 on any axis.
  const shot = () => {
    const roll = (returnWord, subtrahend, bonus) => {
      h.load(HIT_ROLL_SIDES);
      st(0);
      push(ctx.x, 'roll-PHX');
      push(ctx.y, 'roll-PHY');
      random(returnWord);
      h.index('y', pull('roll-PLY'));
      h.index('x', pull('roll-PLX'));
      h.load(dp(0));
      h.load((ctx.a + 1) & WORD_MASK);
      sec();
      sbc(subtrahend);
      sbc(dp(bonus));
      sbc(dp(DP_WEAPON_PENALTY));
      return negative();
    };
    // 89AA: hit with damage limit DPA5 through 8691 (X target, Y shooter).
    const hit = () => {
      h.load(dp(DP_WEAPON_DAMAGE));
      module(callReturn(0x8089ae), () => routines.hit(a, events));
    };
    h.load(dp(DP_WEAPON_KIND));
    compare(ctx.a, CLOSE_KIND_LIMIT);
    let near = !carry();
    if (!near) {
      compare(ctx.a, CLOSE_KIND);
      near = zero();
    }
    if (near) {
      if (roll(callReturn(0x80899a), HIT_ROLL_OFFSET, DP_BONUS_CLOSE)) hit();
      else miss();
      return;
    }
    for (const offset of [OBJECT_X, OBJECT_Y, OBJECT_HEIGHT]) {
      sec();
      h.load(field(offset, ctx.x));
      sbc(field(offset, ctx.y));
      if (negative()) negate();
      compare(ctx.a, RANGED_REACH);
      if (carry()) {
        miss();
        return;
      }
    }
    h.load(dp(DP_WEAPON_KIND));
    compare(ctx.a, DAMAGE_BONUS_KIND);
    if (!zero()) {
      if (roll(callReturn(0x80895c), HIT_ROLL_OFFSET, DP_BONUS_RANGED)) hit();
      else miss();
      return;
    }
    if (!roll(callReturn(0x808977), DAMAGE_BONUS_ROLL_OFFSET, DP_BONUS_KIND_5)) {
      miss();
      return;
    }
    h.load(dp(DP_BONUS_KIND_5));
    lsr();
    clc();
    adc(dp(DP_WEAPON_DAMAGE));
    st(DP_WEAPON_DAMAGE);
    hit();
  };

  // 8A43: a low box on the line (Z clear from LDA DP68 in 81:A25F) lowers DPAB by 2, not below 0.
  const lowBox = () => {
    if (zero()) return;
    h.load(dp(DP_BONUS_CLOSE));
    h.load((ctx.a - 1) & WORD_MASK);
    h.load((ctx.a - 1) & WORD_MASK);
    if (negative()) h.load(0);
    st(DP_BONUS_CLOSE);
  };

  // 8860: weapon of object slot Y. The object number $150A,Y is searched in the 13 words $9700 from
  // X = $18 down; X gives the record pointer $971A/$9734 (bytes 7 -> DPAE, 8 rounded up half -> DPB1,
  // 6 -> DPAB) and the weapon entry $7E3C33+4X (kind DPA2, damage DPA5, signed range DPA8). Kinds 0,
  // 1 and 6 play the shot sound C, 40 or E through 88EB (C46E with DP00 = Y, DP04 = DP06 = FF).
  const weapon = () => {
    push(ctx.y, '8860-PHY');
    h.load(field(OBJECT_NUMBER, ctx.y));
    h.index('x', WEAPON_OWNERS_END);
    // An unknown object number loops for ever in the original; stop after one pass over all X.
    for (let n = 0; ; n++) {
      if (n === WEAPON_SEARCH_LIMIT)
        taskStop('task_native_8860_weapon_search_unbounded', { object: ctx.a });
      h.index('x', (ctx.x - 1) & WORD_MASK);
      h.index('x', (ctx.x - 1) & WORD_MASK);
      compare(ctx.a, field(WEAPON_OWNERS, ctx.x));
      if (zero()) break;
    }
    h.load(field(WEAPON_RECORDS, ctx.x));
    st(DP_WEAPON_RECORD);
    h.load(field(WEAPON_RECORD_BANKS, ctx.x));
    st(DP_WEAPON_RECORD_BANK);
    const record = (n) => {
      h.index('y', n);
      h.load(
        a.readWord(
          ((dp(DP_WEAPON_RECORD) | (h.dp(DP_WEAPON_RECORD_BANK, 1) << WORD_BITS)) + ctx.y) &
            LONG_MASK,
          LONG_WRAP,
          '8860-record-WORD',
        ),
      );
      h.load(ctx.a & BYTE_MASK);
    };
    record(RECORD_BONUS_KIND_5);
    st(DP_BONUS_KIND_5);
    record(RECORD_BONUS_RANGED);
    lsr();
    adc(0);
    st(DP_BONUS_RANGED);
    record(RECORD_BONUS_CLOSE);
    st(DP_BONUS_CLOSE);
    h.load(ctx.x);
    h.asl();
    h.asl();
    h.index('x', ctx.a);
    h.load(h.longRead(WRAM + RUNNER_WEAPON_KIND + ctx.x));
    h.load(ctx.a & BYTE_MASK);
    st(DP_WEAPON_KIND);
    h.load(h.longRead(WRAM + WEAPON_DAMAGE + ctx.x));
    h.load(ctx.a & BYTE_MASK);
    st(DP_WEAPON_DAMAGE);
    h.load(h.longRead(WRAM + RUNNER_WEAPON_RANGE + ctx.x));
    h.load(ctx.a & BYTE_MASK);
    compare(ctx.a, BYTE_SIGN);
    if (carry()) h.load(ctx.a | HIGH_BYTE_MASK);
    st(DP_WEAPON_PENALTY);
    h.index('y', pull('8860-PLY'));
    push(ctx.y, '8860-PHY');
    // 88EB: sound A for object Y, DP00/DP02 saved with PEI and restored.
    const sound = (returnWord) =>
      inline(returnWord, () => {
        push(dp(0), '88EB-PEI-00');
        push(dp(2), '88EB-PEI-02');
        st(0, ctx.y);
        st(DP_SOUND_EFFECT);
        h.load(SHOT_SOUND_LEVEL_VOICES);
        st(DP_SOUND_LEVEL);
        st(DP_SOUND_VOICE);
        module(callReturn(0x8088fc), () => routines.sound(a, events));
        h.load(pull('88FD-PLA'));
        st(2);
        h.load(pull('8900-PLA'));
        st(0);
      });
    h.load(dp(DP_WEAPON_KIND));
    if (zero()) {
      h.load(SHOT_SOUND_KIND_0);
      sound(callReturn(0x8088cc));
    } else {
      compare(ctx.a, 1);
      if (zero()) {
        h.load(SHOT_SOUND_KIND_1);
        sound(callReturn(0x8088d9));
      } else {
        compare(ctx.a, CLOSE_KIND);
        if (zero()) {
          h.load(SHOT_SOUND_KIND_6);
          sound(callReturn(0x8088e6));
        }
      }
    }
    h.index('y', pull('8860-PLY'));
  };

  return { dp, st, carry, negative, inline, sight, lowBox, facing, shot, weapon };
}

export function shootAtObject(a, events, outerReturn = true, routines = NATIVE_8AB5_ROUTINES) {
  return leaf(
    a,
    (h) => {
      const { dp, st, carry, negative, inline, sight, lowBox, facing, shot } = shooterParts(
        h,
        events,
        routines,
      );
      st(DP_HIT_RESULT, 0);
      h.load(dp(2));
      if (!negative()) {
        h.load(dp(DP_SHOT_BONUS));
        st(DP_BONUS_KIND_5);
        st(DP_BONUS_RANGED);
        st(DP_BONUS_CLOSE);
        h.load(dp(DP_SHOT_KIND));
        st(DP_WEAPON_KIND);
        h.load(dp(DP_SHOT_DAMAGE));
        st(DP_WEAPON_DAMAGE);
        h.load(dp(DP_SHOT_PENALTY));
        st(DP_WEAPON_PENALTY);
        h.index('y', dp(0));
        h.index('x', dp(2));
        sight(callReturn(0x808ad6));
        if (carry()) {
          h.load(WORD_MASK);
          st(0);
          return;
        }
        inline(callReturn(0x808adb), lowBox);
        h.index('y', dp(0));
        h.index('x', dp(2));
        inline(callReturn(0x808ae2), facing);
        inline(callReturn(0x808ae5), shot);
      }
      h.load(dp(DP_HIT_RESULT));
      st(0);
    },
    outerReturn,
  );
}

// 80:8A51: the player $0CC2 shoots at the object under the glove ($01DA tagged, slot $01DE) with
// his weapon (8860). No object: DP00 = DPB4 = 0. Blocked sight: DP00 = 1. Otherwise 8A43, the target
// gets bit 4 in $1458 (attacked) and 8904 rolls the hit; DP00 = DPB4.
export function shootAtGloveTarget(a, events, outerReturn = true, routines = NATIVE_8AB5_ROUTINES) {
  return leaf(
    a,
    (h) => {
      const { ctx } = h,
        { dp, st, carry, negative, inline, sight, lowBox, shot, weapon } = shooterParts(
          h,
          events,
          routines,
        );
      const player = () => h.index('y', h.longRead(h.abs(PLAYER_OBJECT)));
      st(DP_HIT_RESULT, 0);
      player();
      inline(callReturn(0x808a58), weapon);
      h.load(h.longRead(h.abs(GLOVE_TARGET_TAG)));
      if (!negative()) {
        h.index('x', h.longRead(h.abs(GLOVE_TARGET_OBJECT)));
        if (!negative()) {
          player();
          sight(callReturn(0x808a69));
          if (carry()) {
            h.load(1);
            st(0);
            return;
          }
          inline(callReturn(0x808a6e), lowBox);
          h.index('x', h.longRead(h.abs(GLOVE_TARGET_OBJECT)));
          player();
          h.load(h.longRead(h.abs(OBJECT_FLAGS) + ctx.x));
          h.load(ctx.a | OBJECT_ATTACKED);
          h.longWrite(h.abs(OBJECT_FLAGS) + ctx.x, ctx.a);
          inline(callReturn(0x808a80), shot);
        }
      }
      h.load(dp(DP_HIT_RESULT));
      st(0);
    },
    outerReturn,
  );
}

// 80:8A8C: object DP00 shoots at object DP02 with its own weapon (8860), facing it (8497).
// Blocked sight: DP00 = FFFF; otherwise DP00 = DPB4 after the hit roll 8904.
export function shootWithOwnWeapon(a, events, outerReturn = true, routines = NATIVE_8AB5_ROUTINES) {
  return leaf(
    a,
    (h) => {
      const { dp, st, carry, inline, sight, lowBox, facing, shot, weapon } = shooterParts(
        h,
        events,
        routines,
      );
      st(DP_HIT_RESULT, 0);
      h.index('y', dp(0));
      inline(callReturn(0x808a92), weapon);
      h.index('y', dp(0));
      h.index('x', dp(2));
      sight(callReturn(0x808a9a));
      if (carry()) {
        h.load(WORD_MASK);
        st(0);
        return;
      }
      inline(callReturn(0x808a9f), lowBox);
      h.index('y', dp(0));
      h.index('x', dp(2));
      inline(callReturn(0x808aa6), facing);
      inline(callReturn(0x808aa9), shot);
      h.load(dp(DP_HIT_RESULT));
      st(0);
    },
    outerReturn,
  );
}

// Special-native forms (src/vm/special-natives.mjs): observations as in the hit 8691.
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits and inputs replay the register-level native.
function observed(run, a, options, outerReturn, lifted = null) {
  const invalid = validateTaskActionsOptions(options);
  if (invalid) taskStop(invalid.reason);
  const events = withInterruptEvents(
    {
      mode: options.waitMode ?? null,
      values: options.waitObservations ?? null,
      waitIndex: 0,
      inputMode: options.inputMode ?? null,
      inputs: options.inputObservations ?? null,
      inputIndex: 0,
      calls: [],
      waitEvents: [],
    },
    options,
  );
  const result =
    lifted !== null && lagFree(events)
      ? { rawReturnWord: drainNativeSequence(lifted(dialogAccess(a), events)) }
      : run(a, events, outerReturn);
  if (events.waitIndex !== (events.values?.length ?? 0))
    taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
  if (events.inputIndex !== (events.inputs?.length ?? 0))
    taskStop('task_input_observation_unused', { observationIndex: events.inputIndex });
  return {
    ...result,
    waitObservationsUsed: events.waitIndex,
    inputObservationsUsed: events.inputIndex,
  };
}
export const shootAtObjectObserved = (a, options, outerReturn = true, lifted = null) =>
  observed(shootAtObject, a, options, outerReturn, lifted);
export const shootAtGloveTargetObserved = (a, options, outerReturn = true, lifted = null) =>
  observed(shootAtGloveTarget, a, options, outerReturn, lifted);
export const shootWithOwnWeaponObserved = (a, options, outerReturn = true, lifted = null) =>
  observed(shootWithOwnWeapon, a, options, outerReturn, lifted);
