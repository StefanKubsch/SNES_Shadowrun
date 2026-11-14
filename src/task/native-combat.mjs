import { withInterruptEvents } from './observed-native-events.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { drainNativeSequence } from './native-call-continuation.mjs';
import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { taskSelectionSupport } from './native-object-turn.mjs';
import { randomBelow } from './native-random.mjs';
import { testLineOfSight, SIGHT_ROUTINE } from './line-of-sight.mjs';
import { showNotice } from './native-notice.mjs';
import { validateTaskActionsOptions } from './native-actions.mjs';

import {
  DP_NOTICE_FRAMES,
  DP_NOTICE_TEXT,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  FIGHT_LIST,
  FIGHT_LIST_INDEX,
  GROUP_INDEX,
  GROUP_LEADER_ONLY,
  GROUP_SLOTS,
  MAGIC_POINTS,
  MEMBER_INDEX,
  OBJECT_ON_SCREEN,
  OBJECT_FLAGS,
  OBJECT_HEIGHT,
  OBJECT_NO_TARGET,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  OBJECT_VELOCITY_Z,
  OBJECT_X,
  OBJECT_Y,
  WRAM,
} from './wram.mjs';
import { WRDIVL, WRDIVB, RDDIVL } from '../constants/hardware-registers.mjs';
import { FLAG_ZERO, FLAG_CARRY, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
import { BANK_WRAP, WORD_MASK, LONG_MASK, BYTE_MASK, WORD_BITS } from '../constants/bits.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';
// Return word of a JSR/JSL frame: the bank offset of the call's last byte.
const callReturn = (address) => address & WORD_MASK;
// 8B43: too few magic points open the notice 0B/14/13/03 with text 1 for 3C frames.
const MAGIC_NOTICE = Object.freeze({
  left: 0x0b,
  top: 0x14,
  columns: 0x13,
  rows: 3,
  text: 1,
  frames: 0x3c,
});
// 8C08: summed distance of the current member, the nearest distance and member so far.
const DP_MEMBER_DISTANCE = 0xa2,
  DP_NEAREST_DISTANCE = 0xa5,
  DP_NEAREST_MEMBER = 0xa8;
// 8D95: target point, sign flags (FFFF: negative) and magnitudes per axis, the half divisor
// and the extra halving request DP04 (FFFF from 8D7F); the axis sum is shifted right four times.
const DP_POINT_X = 0xb4,
  DP_POINT_Y = 0xb7,
  DP_POINT_HEIGHT = 0xba,
  DP_SIGN_X = 0xa8,
  DP_SIGN_Y = 0xab,
  DP_SIGN_HEIGHT = 0xae,
  DP_DISTANCE_X = 0xa2,
  DP_DISTANCE_Y = 0xa5,
  DP_HALF_DIVISOR = 0xb1,
  DP_EXTRA_HALVING = 4,
  DIVISOR_SHIFT = 4;
// 8D4E: long pointer to the point list (6 bytes per point).
const DP_POINT_LIST = 0xf3;
// Combat natives of bank 80 between 8B43 and 8E35 (source: tools/task-native-combat-source.mjs). Fixed
// equations over the own code; proved routines (random C51F, line of sight 81:A25F, notice FEC1) run
// their modules with the real JSR/JSL frames. The hardware divider ($4204/$4206/$4214) is computed by
// the memory model like every arithmetic register.
export const NATIVE_COMBAT_ROUTINES = Object.freeze({
  random: (a) => randomBelow(a, false),
  notice: (a, events) => showNotice(a, events, false),
});

function support(h, routines, events) {
  const { a, ctx } = h,
    k = taskSelectionSupport(h);
  const st = (n, v = ctx.a) => a.writeWord(n, v, BANK_WRAP, 'combat-DP-WORD');
  const field = (offset, index) => h.longRead(h.abs(offset) + index);
  const bit = (mask) => {
    ctx.status = (ctx.status & ~FLAG_ZERO) | (ctx.a & mask ? 0 : FLAG_ZERO);
    return (ctx.a & mask) !== 0;
  };
  const carry = () => (ctx.status & FLAG_CARRY) !== 0,
    negative = () => (ctx.status & FLAG_NEGATIVE) !== 0;
  const lsr = () => {
    ctx.status = (ctx.status & ~FLAG_CARRY) | (ctx.a & 1);
    h.load(ctx.a >>> 1);
  };
  const negate = () => {
    h.load(ctx.a ^ WORD_MASK);
    h.load((ctx.a + 1) & WORD_MASK);
  };
  const module = (returnWord, run) => {
    a.pushWord(returnWord, 'combat-JSR');
    const result = run();
    if (result.rawReturnWord !== returnWord)
      taskStop('task_native_helper_return_required', {
        actual: result.rawReturnWord,
        expected: returnWord,
      });
  };
  // JSL 81:A25F (Y viewer, X target): carry set = sight blocked.
  const sight = (returnWord) => {
    a.write(ctx.s, ctx.programBank, 'combat-JSL-bank');
    ctx.s = (ctx.s - 1) & WORD_MASK;
    a.pushWord(returnWord, 'combat-JSL-WORD');
    ctx.programBank = SIGHT_ROUTINE >>> WORD_BITS;
    ctx.pc = SIGHT_ROUTINE & WORD_MASK;
    const result = testLineOfSight(h);
    if (result.rawReturnWord !== returnWord || ctx.programBank !== CODE_BANK)
      taskStop('task_native_long_return_required', {
        raw: result.rawReturnWord,
        bank: ctx.programBank,
      });
  };
  const random = (returnWord) => module(returnWord, () => routines.random(a));
  const notice = (returnWord) => module(returnWord, () => routines.notice(a, events));
  // 8-bit SEP #$20 section: A low byte only, high byte kept.
  const byte = (address) => h.load(a.read(address & LONG_MASK, 'combat-BYTE'), 1);
  return { a, ctx, k, st, field, bit, carry, negative, lsr, negate, sight, random, notice, byte };
}

// 80:8B43: spend magic points: the magic points $7E3C96 of member $1F60/2 (BYTE) minus the
// first argument. Enough: store, DP00 = FFFF.
// Too little: unchanged, notice FEC1 (window 0B/14, width 13, height 3, text 1, one second), DP00 = 0.
export function spendMagicPoints(a, events, outerReturn = true, routines = NATIVE_COMBAT_ROUTINES) {
  return leaf(
    a,
    (h) => {
      const { ctx, k, st, lsr, carry, notice, byte } = support(h, routines, events);
      h.load(h.longRead(h.abs(MEMBER_INDEX)));
      lsr();
      h.index('x', ctx.a);
      ctx.status |= FLAG_CARRY;
      byte(WRAM + MAGIC_POINTS + ctx.x);
      k.byteArithmetic(a.read(0, 'combat-DP00-BYTE'), true);
      if (carry()) {
        a.write(WRAM + MAGIC_POINTS + ctx.x, ctx.a & BYTE_MASK, 'combat-7E3C96-BYTE');
        h.load(WORD_MASK);
        st(0);
        return;
      }
      for (const [offset, value] of [
        [DP_WINDOW_LEFT, MAGIC_NOTICE.left],
        [DP_WINDOW_TOP, MAGIC_NOTICE.top],
        [DP_WINDOW_COLUMNS, MAGIC_NOTICE.columns],
        [DP_WINDOW_ROWS, MAGIC_NOTICE.rows],
        [DP_WINDOW_ATTRIBUTES, 0],
        [DP_NOTICE_TEXT, MAGIC_NOTICE.text],
        [DP_NOTICE_FRAMES, MAGIC_NOTICE.frames],
      ]) {
        h.load(value);
        st(offset);
      }
      notice(callReturn(0x808b86));
      st(0, 0);
    },
    outerReturn,
  );
}

// 80:8C08: find the nearest visible member of the group $1FA8 for object DP00 (sum of the axis distances,
// strictly smaller wins, members with bit 12 in $1458 skipped, sight 81:A25F). Without bit 2 in
// $1458 of DP00 or without a candidate: FFFF. The group runs from $7E2DE6 down (only index 0 when $1D6B).
export function findNearestVisibleMember(a, outerReturn = true) {
  return leaf(
    a,
    (h) => {
      const { ctx, k, st, field, bit, carry, negative, negate, sight } = support(
        h,
        NATIVE_COMBAT_ROUTINES,
        null,
      );
      h.index('y', h.dp(FIRST_ARGUMENT));
      h.load(field(OBJECT_FLAGS, ctx.y));
      if (!bit(OBJECT_ON_SCREEN)) {
        h.load(WORD_MASK);
        st(0);
        return;
      }
      h.load(h.longRead(h.abs(GROUP_LEADER_ONLY)));
      if (ctx.status & FLAG_ZERO) {
        h.load(h.longRead(WRAM + GROUP_INDEX));
        h.index('y', ctx.a);
      } else h.index('y', 0);
      h.load(WORD_MASK);
      st(DP_NEAREST_DISTANCE);
      st(DP_NEAREST_MEMBER);
      do {
        h.index('x', field(GROUP_SLOTS, ctx.y));
        a.pushWord(ctx.y, '8c31-PHY');
        h.index('y', h.dp(FIRST_ARGUMENT));
        const distance = (offset) => {
          ctx.status |= FLAG_CARRY;
          h.load(field(offset, ctx.x));
          h.arithmetic(field(offset, ctx.y), true);
          if (!carry()) negate();
        };
        distance(OBJECT_X);
        st(DP_MEMBER_DISTANCE);
        for (const offset of [OBJECT_Y, OBJECT_HEIGHT]) {
          distance(offset);
          ctx.status &= ~FLAG_CARRY;
          h.arithmetic(h.dp(DP_MEMBER_DISTANCE));
          if (offset === OBJECT_Y) st(DP_MEMBER_DISTANCE);
        }
        k.compare(ctx.a, h.dp(DP_NEAREST_DISTANCE));
        if (!carry()) {
          st(DP_MEMBER_DISTANCE);
          h.load(field(OBJECT_FLAGS, ctx.x));
          if (!bit(OBJECT_NO_TARGET)) {
            h.index('y', h.dp(FIRST_ARGUMENT));
            a.pushWord(ctx.x, '8c75-PHX');
            sight(callReturn(0x808c79));
            h.index('x', a.pullWord('8c7a-PLX'));
            if (!carry()) {
              a.writeWord(DP_NEAREST_MEMBER, ctx.x, BANK_WRAP, '8c7d-STX');
              h.load(h.dp(DP_MEMBER_DISTANCE));
              st(DP_NEAREST_DISTANCE);
            }
          }
        }
        h.index('y', a.pullWord('8c83-PLY'));
        h.index('y', (ctx.y - 1) & WORD_MASK);
        h.index('y', (ctx.y - 1) & WORD_MASK);
      } while (!negative());
      h.load(h.dp(DP_NEAREST_MEMBER));
      st(0);
    },
    outerReturn,
  );
}

// 80:8C8D: choose a random target of the fight list $1FB2 (count $1FB0) for object DP00: C51F below
// ($1FB0 >> 1) + 1. FFFF without bit 2 in $1458 of DP00, with an empty list, a candidate with bit 12 or
// without bit 2, or a blocked sight; otherwise the candidate.
export function chooseRandomFightTarget(a, outerReturn = true, routines = NATIVE_COMBAT_ROUTINES) {
  return leaf(
    a,
    (h) => {
      const { ctx, st, field, bit, carry, negative, lsr, sight, random } = support(
        h,
        routines,
        null,
      );
      const none = () => {
        h.load(WORD_MASK);
        st(0);
      };
      h.index('y', h.dp(FIRST_ARGUMENT));
      h.load(field(OBJECT_FLAGS, ctx.y));
      if (!bit(OBJECT_ON_SCREEN)) {
        none();
        return;
      }
      h.load(h.longRead(h.abs(FIGHT_LIST_INDEX)));
      if (negative()) {
        none();
        return;
      }
      a.pushWord(ctx.y, '8c9c-PHY');
      lsr();
      h.load((ctx.a + 1) & WORD_MASK);
      st(0);
      random(callReturn(0x808ca3));
      h.load(h.dp(FIRST_ARGUMENT));
      h.asl();
      h.index('x', ctx.a);
      h.load(a.pullWord('8ca8-PLA'));
      st(0);
      h.index('y', field(FIGHT_LIST, ctx.x));
      h.load(field(OBJECT_FLAGS, ctx.y));
      if (bit(OBJECT_NO_TARGET) || !bit(OBJECT_ON_SCREEN)) {
        none();
        return;
      }
      a.pushWord(ctx.y, '8cbb-PHY');
      h.index('x', ctx.y);
      h.index('y', h.dp(FIRST_ARGUMENT));
      sight(callReturn(0x808cc2));
      h.index('y', a.pullWord('8cc3-PLY'));
      if (carry()) {
        none();
        return;
      }
      a.writeWord(FIRST_ARGUMENT, ctx.y, BANK_WRAP, '8cc6-STY');
    },
    outerReturn,
  );
}

// 80:8CCF: can object DP00 (first argument) attack DP02 (second argument)? Both need bit 2 in $1458, DP02 without bit 12 and in the
// fight list $1FB2; then the sight 81:A25F decides. Yes: DP00 = FFFF, no: 0.
export function canObjectAttack(a, outerReturn = true) {
  return leaf(
    a,
    (h) => {
      const { ctx, k, st, field, bit, carry, negative, sight } = support(
        h,
        NATIVE_COMBAT_ROUTINES,
        null,
      );
      const no = () => st(0, 0);
      h.index('y', h.dp(FIRST_ARGUMENT));
      h.load(field(OBJECT_FLAGS, ctx.y));
      if (!bit(OBJECT_ON_SCREEN)) {
        no();
        return;
      }
      h.index('y', h.dp(SECOND_ARGUMENT));
      h.load(field(OBJECT_FLAGS, ctx.y));
      if (bit(OBJECT_NO_TARGET) || !bit(OBJECT_ON_SCREEN)) {
        no();
        return;
      }
      h.index('x', h.longRead(h.abs(FIGHT_LIST_INDEX)));
      if (negative()) {
        no();
        return;
      }
      h.load(h.dp(SECOND_ARGUMENT));
      for (;;) {
        k.compare(ctx.a, field(FIGHT_LIST, ctx.x));
        if (ctx.status & FLAG_ZERO) break;
        h.index('x', (ctx.x - 1) & WORD_MASK);
        h.index('x', (ctx.x - 1) & WORD_MASK);
        if (negative()) {
          no();
          return;
        }
      }
      h.index('y', h.dp(FIRST_ARGUMENT));
      h.index('x', h.dp(SECOND_ARGUMENT));
      sight(callReturn(0x808d02));
      if (carry()) {
        no();
        return;
      }
      h.load(WORD_MASK);
      st(0);
    },
    outerReturn,
  );
}

// 8D95 (shared by 8D7F, 8D3F and 8D4E): velocity of object DP00 towards the point DPB4/DPB7/DPBA.
// Per axis the magnitude of point minus object (negative: DPA8/DPAB/DPAE = FFFF); the divisor is the sum
// >> 4 (one more >> 1 when DP04 was FFFF, at least 1, only its low byte reaches $4206), the quotients
// with sign go to $0DD0 (z), $0D20 (x), $0D78 (y) of the object; divisor to DP00 and half of it to DPB1.
function runVelocityTowardsPoint(h, s) {
  const { a, ctx, st, negative, lsr, negate } = s;
  for (const offset of [DP_SIGN_X, DP_SIGN_Y, DP_SIGN_HEIGHT]) st(offset, 0);
  h.index('y', h.dp(FIRST_ARGUMENT));
  const axis = (point, offset, sign) => {
    ctx.status |= FLAG_CARRY;
    h.load(h.dp(point));
    h.arithmetic(h.longRead(h.abs(offset) + ctx.y), true);
    if (!negative()) return;
    negate();
    const value = ctx.a;
    st(sign, (h.dp(sign) - 1) & WORD_MASK);
    h.nz(h.dp(sign));
    ctx.a = value;
  };
  axis(DP_POINT_X, OBJECT_X, DP_SIGN_X);
  st(DP_DISTANCE_X);
  axis(DP_POINT_Y, OBJECT_Y, DP_SIGN_Y);
  st(DP_DISTANCE_Y);
  axis(DP_POINT_HEIGHT, OBJECT_HEIGHT, DP_SIGN_HEIGHT);
  const io = (pc, offset, width) =>
    a.absoluteWrite(offset, width === 1 ? ctx.a & BYTE_MASK : ctx.a, width, pc, 'combat-divider');
  io(0x808dcb, WRDIVL, 2);
  ctx.status &= ~FLAG_CARRY;
  h.arithmetic(h.dp(DP_DISTANCE_X));
  h.arithmetic(h.dp(DP_DISTANCE_Y));
  for (let n = 0; n < DIVISOR_SHIFT; n++) lsr();
  const counter = (h.dp(DP_EXTRA_HALVING) + 1) & WORD_MASK;
  st(DP_EXTRA_HALVING, counter);
  h.nz(counter);
  if (counter === 0) lsr();
  s.k.compare(ctx.a, 0);
  if (ctx.status & FLAG_ZERO) h.load(1);
  io(0x808de6, WRDIVB, 1);
  st(0);
  lsr();
  st(DP_HALF_DIVISOR);
  const quotient = (pc, sign, target) => {
    h.load(h.dp(sign));
    h.load(ctx.a ^ a.absoluteRead(RDDIVL, 2, pc, 'combat-quotient'));
    if (negative()) h.load((ctx.a + 1) & WORD_MASK);
    h.longWrite(h.abs(target) + ctx.y, ctx.a);
  };
  quotient(0x808df2, DP_SIGN_HEIGHT, OBJECT_VELOCITY_Z);
  for (const [dividendPc, divisorPc, quotientPc, magnitude, sign, target] of [
    [0x808dfd, 0x808e04, 0x808e0f, DP_DISTANCE_X, DP_SIGN_X, OBJECT_VELOCITY_X],
    [0x808e1a, 0x808e21, 0x808e2c, DP_DISTANCE_Y, DP_SIGN_Y, OBJECT_VELOCITY_Y],
  ]) {
    h.load(h.dp(magnitude));
    io(dividendPc, WRDIVL, 2);
    s.byte(0);
    io(divisorPc, WRDIVB, 1);
    quotient(quotientPc, sign, target);
  }
}
// 8D84: point = position of object DP02.
function runVelocityTowardsObject(h, s) {
  h.index('x', h.dp(SECOND_ARGUMENT));
  for (const [offset, point] of [
    [OBJECT_X, DP_POINT_X],
    [OBJECT_Y, DP_POINT_Y],
    [OBJECT_HEIGHT, DP_POINT_HEIGHT],
  ]) {
    h.load(s.field(offset, h.ctx.x));
    s.st(point);
  }
  runVelocityTowardsPoint(h, s);
}
// Height step of 8D3F/8D4E: $0DD0 of object Y plus DPB1.
function addRise(h, s) {
  h.ctx.status &= ~FLAG_CARRY;
  h.load(s.field(OBJECT_VELOCITY_Z, h.ctx.y));
  h.arithmetic(h.dp(DP_HALF_DIVISOR));
  h.longWrite(h.abs(OBJECT_VELOCITY_Z) + h.ctx.y, h.ctx.a);
}
const inline = (h, returnWord, run) => {
  h.a.pushWord(returnWord, 'combat-JSR');
  run();
  const raw = h.a.pullWord('combat-RTS');
  if (raw !== returnWord)
    taskStop('task_native_helper_return_required', { actual: raw, expected: returnWord });
};

// 80:8D7F: object DP00 moves towards object DP02 (DP04 = FFFF: one more halving of the divisor).
export const moveObjectTowardsObject = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const s = support(h, NATIVE_COMBAT_ROUTINES, null);
      h.load(WORD_MASK);
      s.st(DP_EXTRA_HALVING);
      runVelocityTowardsObject(h, s);
    },
    outerReturn,
  );
// 80:8D3F: object DP00 jumps towards object DP02 (DP04 = 0), the height speed gets DPB1 on top.
export const jumpObjectTowardsObject = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const s = support(h, NATIVE_COMBAT_ROUTINES, null);
      s.st(DP_EXTRA_HALVING, 0);
      inline(h, callReturn(0x808d43), () => runVelocityTowardsObject(h, s));
      addRise(h, s);
    },
    outerReturn,
  );
// 80:8D4E: object DP00 jumps towards point DP02 of the list [$F3] (6 bytes per point, words at
// +1/+3/+5 times 4), as 8D3F.
export const jumpObjectTowardsPoint = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const s = support(h, NATIVE_COMBAT_ROUTINES, null),
        { ctx } = h;
      s.st(DP_EXTRA_HALVING, 0);
      h.load(h.dp(SECOND_ARGUMENT));
      h.asl();
      h.asl();
      h.asl();
      ctx.status |= FLAG_CARRY;
      h.arithmetic(h.dp(SECOND_ARGUMENT), true);
      h.arithmetic(h.dp(SECOND_ARGUMENT), true);
      h.index('y', ctx.a);
      for (const point of [DP_POINT_X, DP_POINT_Y, DP_POINT_HEIGHT]) {
        h.index('y', (ctx.y + (point === DP_POINT_X ? 1 : 2)) & WORD_MASK);
        h.load(s.k.indirect(DP_POINT_LIST, ctx.y));
        h.asl();
        h.asl();
        s.st(point);
      }
      inline(h, callReturn(0x808d74), () => runVelocityTowardsPoint(h, s));
      addRise(h, s);
    },
    outerReturn,
  );

// Special-native forms with observations (FEC1 waits); the others need none.
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits replay the register-level native.
export function spendMagicPointsObserved(a, options, outerReturn = true, lifted = null) {
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
      : spendMagicPoints(a, events, outerReturn);
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
