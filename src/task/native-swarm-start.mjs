import { taskStop } from './plan.mjs';
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { createObject } from './native-object-create.mjs';
import { setObjectDirection } from './native-object-action-set.mjs';
import { lsr, clc, WAVE_TABLE, PHASE_MASK, QUARTER_PHASE } from './native-object-bob.mjs';
import {
  CIRCLE_FOLLOWER_COUNTDOWN,
  CIRCLE_FOLLOWER_INDEX,
  CIRCLE_FOLLOWERS,
  CIRCLE_HEIGHT_PHASE,
  CIRCLE_LEADER,
  CIRCLE_PHASE,
  CIRCLE_PHASE_SPEED,
  CIRCLE_SPEED,
  DP_OBJECT_HEIGHT,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
  PATH_SPEED_HEIGHT,
  PATH_SPEED_HEIGHT_GOAL,
  PATH_SPEED_XY,
  PATH_SPEED_XY_GOAL,
  PATH_START_HEIGHT,
  PATH_START_HEIGHT_GOAL,
  PATH_START_XY,
  PATH_START_XY_GOAL,
  SWARM_FOUR_ORIGIN,
  SWARM_MEMBERS,
  SWARM_ORIGIN_HEIGHT,
  SWARM_ORIGIN_X,
  SWARM_ORIGIN_Y,
  SWARM_TWELVE_ORIGIN,
  WAVE_CLEARED,
  WAVE_PHASE,
  WAVE_SECOND_PHASE,
  WAVE_TARGET_HEIGHT,
  WAVE_TARGET_X,
  WAVE_TARGET_Y,
} from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
import { WORD_MASK, BANK_WRAP, BYTE_MASK, BYTE_BITS } from '../constants/bits.mjs';
// Swarm natives around the proved object creation A835 (and the action AAAF), each with real JSR/RTS
// frames. Tests may replace the called routines (routines.create/action receive the accessor).
// Return word of a JSR: the bank offset of the call's last byte.
const callReturn = (address) => address & WORD_MASK;
// D7DD: kind 8C, or 106 with bit 7 of DP00, script 32F; four members, both goals 100.
const FOUR_SWARM_FLAG = 0x80,
  FOUR_KIND = 0x8c,
  FOUR_FLAGGED_KIND = 0x106,
  FOUR_SCRIPT = 0x032f,
  FOUR_MEMBERS_END = 8,
  FOUR_GOAL = 0x100;
// D260: kind 4D, or DF with bit 0 of DP00, at A0/17C/40 with the script words 80:D2DD (from
// byte offset 8 on always the fifth word); twelve members.
const TWELVE_SWARM_FLAG = 1,
  TWELVE_KIND = 0x4d,
  TWELVE_FLAGGED_KIND = 0xdf,
  TWELVE_START = Object.freeze({ x: 0xa0, y: 0x17c, height: 0x40 }),
  TWELVE_SCRIPTS = 0xd2dd,
  TWELVE_LAST_SCRIPT = 8,
  TWELVE_MEMBERS_END = 0x18;
// D63C: the speed limits +-14, the circle around 680/AC8 at height 160, the direction rounding
// by half a facing and eight facings; every eighth call a follower 78 at 19B/293/65 with
// the scripts 80:D704, eight in all.
const CIRCLE_SPEED_LIMIT = 0x14,
  CIRCLE_SPEED_FLOOR = 0xffec,
  CIRCLE_BASE_HEIGHT = 0x160,
  CIRCLE_BASE_X = 0x680,
  CIRCLE_BASE_Y = 0xac8,
  FACING_ROUNDING = 0x20,
  FACING_MASK = 7,
  FOLLOWER = Object.freeze({ kind: 0x78, x: 0x19b, y: 0x293, height: 0x65 }),
  FOLLOWER_SCRIPTS = 0xd704,
  FOLLOWER_INTERVAL = 8,
  FOLLOWERS_END = 0x10;
const SWARM_ROUTINES = Object.freeze({
  create: (a) => createObject(a, false),
  action: (a) => setObjectDirection(a, false),
});
const support = (a, h) => ({
  compare: (left, right) => {
    h.nz((left - right) & WORD_MASK);
    h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | Number(left >= right);
  },
  read: (offset) => h.longRead(h.abs(offset)),
  write: (offset, value) => h.longWrite(h.abs(offset), value),
  store: (offset, value) => {
    h.load(value);
    a.writeWord(offset, h.ctx.a, BANK_WRAP, 'swarm-DP-WORD');
  },
  call: (returnWord, run) => {
    a.pushWord(returnWord, 'swarm-JSR');
    const result = run(a);
    if (result.rawReturnWord !== returnWord)
      taskStop('task_native_helper_return_required', {
        actual: result.rawReturnWord,
        expected: returnWord,
      });
  },
});
// Origin of the swarm: object DP00 (bit 7 masked) to 1CF7 (D7DD) or 1D07 (D260, bit 0 masked); its 0E28/0E80/0ED8
// to 1D0B/1D0D/1D0F.
const origin = (h, s, mask, keep) => {
  const { ctx } = h;
  h.load(h.dp(FIRST_ARGUMENT));
  h.index('x', ctx.a);
  h.load(ctx.a & mask);
  s.write(keep, ctx.a);
  h.index('y', ctx.a);
  for (const [from, to] of [
    [OBJECT_X, SWARM_ORIGIN_X],
    [OBJECT_Y, SWARM_ORIGIN_Y],
    [OBJECT_HEIGHT, SWARM_ORIGIN_HEIGHT],
  ]) {
    h.load(h.longRead(h.abs(from) + ctx.y));
    s.write(to, ctx.a);
  }
};
// 80:D7DD: start the path swarm: four objects of type 106 (DP00 bit 7) or 8C at a quarter of the origin's coordinates (sprite
// 032F) through A835; their slots (low byte) to 1CEF..1CF5; swing state cleared, 1D43/1D45 = 0100.
export const startPathSwarm = (a, outerReturn = true, routines = SWARM_ROUTINES) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        s = support(a, h);
      origin(h, s, WORD_MASK ^ FOUR_SWARM_FLAG, SWARM_FOUR_ORIGIN);
      h.index('y', 0);
      do {
        h.load(ctx.x);
        h.load(ctx.a & FOUR_SWARM_FLAG);
        s.store(DP_OBJECT_KIND, ctx.status & FLAG_ZERO ? FOUR_KIND : FOUR_FLAGGED_KIND);
        for (const [table, offset] of [
          [OBJECT_X, DP_OBJECT_X],
          [OBJECT_Y, DP_OBJECT_Y],
          [OBJECT_HEIGHT, DP_OBJECT_HEIGHT],
        ]) {
          h.load(h.longRead(h.abs(table) + ctx.x));
          lsr(h);
          lsr(h);
          a.writeWord(offset, ctx.a, BANK_WRAP, 'd7dd-DP');
        }
        s.store(DP_OBJECT_SCRIPT, FOUR_SCRIPT);
        a.pushWord(ctx.x, 'd7dd-PHX');
        a.pushWord(ctx.y, 'd7dd-PHY');
        s.call(callReturn(0x80d82a), routines.create);
        h.index('y', a.pullWord('d7dd-PLY'));
        h.index('x', a.pullWord('d7dd-PLX'));
        h.load(h.dp(FIRST_ARGUMENT));
        h.load(ctx.a & BYTE_MASK);
        h.longWrite(h.abs(SWARM_MEMBERS) + ctx.y, ctx.a);
        h.index('y', ctx.y + 2);
        s.compare(ctx.y, FOUR_MEMBERS_END);
      } while (!(ctx.status & FLAG_ZERO));
      for (const offset of [
        PATH_SPEED_XY,
        PATH_SPEED_HEIGHT,
        PATH_START_HEIGHT_GOAL,
        PATH_SPEED_HEIGHT_GOAL,
        PATH_START_XY,
        PATH_START_HEIGHT,
      ])
        s.write(offset, 0);
      h.load(FOUR_GOAL);
      s.write(PATH_START_XY_GOAL, ctx.a);
      h.load(FOUR_GOAL);
      s.write(PATH_SPEED_XY_GOAL, ctx.a);
    },
    outerReturn,
  );
// 80:D260: start the wave swarm: twelve objects of type DF (DP00 bit 0) or 4D at A0/17C/40 with the sprites D2DD+Y (from Y = 8
// on the last one) through A835; slots to 1CEF..1D05; targets 1D17/1D19/1D1B = origin, 1D33/1D35/1D49 cleared.
export const startWaveSwarm = (a, outerReturn = true, routines = SWARM_ROUTINES) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        s = support(a, h);
      origin(h, s, BYTE_MASK ^ TWELVE_SWARM_FLAG, SWARM_TWELVE_ORIGIN);
      h.index('y', 0);
      do {
        a.pushWord(ctx.x, 'd260-PHX');
        a.pushWord(ctx.y, 'd260-PHY');
        h.load(ctx.x);
        h.load(ctx.a & TWELVE_SWARM_FLAG);
        s.store(DP_OBJECT_KIND, ctx.status & FLAG_ZERO ? TWELVE_KIND : TWELVE_FLAGGED_KIND);
        s.store(DP_OBJECT_X, TWELVE_START.x);
        s.store(DP_OBJECT_Y, TWELVE_START.y);
        s.store(DP_OBJECT_HEIGHT, TWELVE_START.height);
        s.compare(ctx.y, TWELVE_LAST_SCRIPT);
        if (ctx.status & FLAG_CARRY) h.index('y', TWELVE_LAST_SCRIPT);
        h.load(h.longRead(h.abs(TWELVE_SCRIPTS) + ctx.y));
        a.writeWord(DP_OBJECT_SCRIPT, ctx.a, BANK_WRAP, 'd260-DP08');
        s.call(callReturn(0x80d2af), routines.create);
        h.index('y', a.pullWord('d260-PLY'));
        h.index('x', a.pullWord('d260-PLX'));
        h.load(h.dp(FIRST_ARGUMENT));
        h.load(ctx.a & BYTE_MASK);
        h.longWrite(h.abs(SWARM_MEMBERS) + ctx.y, ctx.a);
        h.index('y', ctx.y + 2);
        s.compare(ctx.y, TWELVE_MEMBERS_END);
      } while (!(ctx.status & FLAG_ZERO));
      for (const [from, to] of [
        [SWARM_ORIGIN_X, WAVE_TARGET_X],
        [SWARM_ORIGIN_Y, WAVE_TARGET_Y],
        [SWARM_ORIGIN_HEIGHT, WAVE_TARGET_HEIGHT],
      ]) {
        h.load(s.read(from));
        s.write(to, ctx.a);
      }
      for (const offset of [WAVE_PHASE, WAVE_SECOND_PHASE, WAVE_CLEARED]) s.write(offset, 0);
    },
    outerReturn,
  );
// 80:D63C: circle the swarm leader: the leader 1D4D circles: speed 1D35 "clamped" by two unsigned compares (from 14 on: 14; below
// FFEC: FFEC), which always leave FFEC; phases 1D55 += 1D37 and 1D53 += 1D35;
// height D3D1[1D53]/2 + 160, position D3D1[1D55] + 680, depth D3D1[1D55+80] + AC8; the direction
// ((1D55+20)*4)>>8 & 7 through AAAF. Every eighth call (1D33 counting down, negative: never) A835 adds one
// follower (78/19B/293/65, sprite D704+Y) to 1CFF+Y, eight in all.
export const circleSwarmLeader = (a, outerReturn = true, routines = SWARM_ROUTINES) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        s = support(a, h),
        table = () => {
          h.load(h.longRead(h.abs(WAVE_TABLE) + ctx.y));
          h.load(ctx.a & BYTE_MASK);
        };
      h.load(s.read(CIRCLE_SPEED));
      s.compare(ctx.a, CIRCLE_SPEED_LIMIT);
      if (ctx.status & FLAG_CARRY) h.load(CIRCLE_SPEED_LIMIT);
      s.compare(ctx.a, CIRCLE_SPEED_FLOOR);
      if (!(ctx.status & FLAG_CARRY)) h.load(CIRCLE_SPEED_FLOOR);
      s.write(CIRCLE_SPEED, ctx.a);
      h.load(s.read(CIRCLE_PHASE));
      clc(h);
      h.arithmetic(s.read(CIRCLE_PHASE_SPEED));
      h.load(ctx.a & PHASE_MASK);
      s.write(CIRCLE_PHASE, ctx.a);
      h.load(s.read(CIRCLE_HEIGHT_PHASE));
      clc(h);
      h.arithmetic(s.read(CIRCLE_SPEED));
      h.load(ctx.a & PHASE_MASK);
      s.write(CIRCLE_HEIGHT_PHASE, ctx.a);
      h.index('y', ctx.a);
      table();
      lsr(h);
      clc(h);
      h.arithmetic(CIRCLE_BASE_HEIGHT);
      h.index('x', s.read(CIRCLE_LEADER));
      h.longWrite(h.abs(OBJECT_HEIGHT) + ctx.x, ctx.a);
      h.index('y', s.read(CIRCLE_PHASE));
      table();
      clc(h);
      h.arithmetic(CIRCLE_BASE_X);
      h.longWrite(h.abs(OBJECT_X) + ctx.x, ctx.a);
      h.load(s.read(CIRCLE_PHASE));
      clc(h);
      h.arithmetic(QUARTER_PHASE);
      h.load(ctx.a & PHASE_MASK);
      h.index('y', ctx.a);
      table();
      clc(h);
      h.arithmetic(CIRCLE_BASE_Y);
      h.longWrite(h.abs(OBJECT_Y) + ctx.x, ctx.a);
      a.writeWord(FIRST_ARGUMENT, ctx.x, BANK_WRAP, 'd63c-STX-DP00');
      h.load(s.read(CIRCLE_PHASE));
      clc(h);
      h.arithmetic(FACING_ROUNDING);
      h.load(ctx.a & PHASE_MASK);
      h.asl();
      h.asl();
      ctx.a = ((ctx.a >>> BYTE_BITS) | (ctx.a << BYTE_BITS)) & WORD_MASK;
      h.nz(ctx.a & BYTE_MASK, 1);
      h.load(ctx.a & FACING_MASK);
      a.writeWord(SECOND_ARGUMENT, ctx.a, BANK_WRAP, 'd63c-DP02');
      s.call(callReturn(0x80d6bc), routines.action);
      h.load(s.read(CIRCLE_FOLLOWER_COUNTDOWN));
      if (ctx.status & FLAG_NEGATIVE) return;
      const count = h.nz((s.read(CIRCLE_FOLLOWER_COUNTDOWN) - 1) & WORD_MASK);
      s.write(CIRCLE_FOLLOWER_COUNTDOWN, count);
      if (count !== 0) return;
      h.index('y', s.read(CIRCLE_FOLLOWER_INDEX));
      s.store(DP_OBJECT_KIND, FOLLOWER.kind);
      s.store(DP_OBJECT_X, FOLLOWER.x);
      s.store(DP_OBJECT_Y, FOLLOWER.y);
      s.store(DP_OBJECT_HEIGHT, FOLLOWER.height);
      h.load(h.longRead(h.abs(FOLLOWER_SCRIPTS) + ctx.y));
      a.writeWord(DP_OBJECT_SCRIPT, ctx.a, BANK_WRAP, 'd63c-DP08');
      a.pushWord(ctx.y, 'd63c-PHY');
      s.call(callReturn(0x80d6e6), routines.create);
      h.index('y', a.pullWord('d63c-PLY'));
      h.load(h.dp(FIRST_ARGUMENT));
      h.longWrite(h.abs(CIRCLE_FOLLOWERS) + ctx.y, ctx.a);
      h.index('y', ctx.y + 2);
      s.write(CIRCLE_FOLLOWER_INDEX, ctx.y);
      h.load(FOLLOWER_INTERVAL);
      s.write(CIRCLE_FOLLOWER_COUNTDOWN, ctx.a);
      s.compare(ctx.y, FOLLOWERS_END);
      if (ctx.status & FLAG_ZERO) {
        h.load(WORD_MASK);
        s.write(CIRCLE_FOLLOWER_COUNTDOWN, ctx.a);
      }
    },
    outerReturn,
  );
