import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { taskSelectionSupport } from './native-object-turn.mjs';
import { WAVE_TABLE, PHASE_MASK } from './native-object-bob.mjs';
import {
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
  SWARM_HEIGHT,
  SWARM_MEMBERS,
  SWARM_ORIGIN_HEIGHT,
  SWARM_ORIGIN_X,
  SWARM_ORIGIN_Y,
  SWARM_X,
  SWARM_Y,
  WAVE_HEIGHT_PART,
  WAVE_MEMBER_PHASE,
  WAVE_MEMBER_SECOND_PHASE,
  WAVE_PHASE,
  WAVE_SECOND_PHASE,
  WAVE_TARGET_HEIGHT,
  WAVE_TARGET_X,
  WAVE_TARGET_Y,
} from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_MASK, BYTE_MASK } from '../constants/bits.mjs';
// 80:D2E7: move the swarm as a wave. A first argument of 1 sets the targets 1D17/1D19/1D1B to four
// times the words [F3]+6*(second argument)+1/+3/+5 (the SBCs keep their carry). Otherwise 1D0B/1D0D step by 2 towards 1D17/1D19 (down when not below), 1D23/1D25/
// 1D27 start at 1D0B/1D0D/1D0F, the phases 1D33 += 0A and 1D35 -= 8 (mod 200) seed 1D37/1D39, and thirteen
// objects 1CEF+Y (Y = 0..18) get the height D3D1[1D37] + D3D1[1D39] + E8 (the first ADC without CLC keeps
// the carry of the previous phase step), the position 1D23 and the depth 1D25 - 18 (stepping down per object).
const DP_POINT_LIST = 0xf3,
  WAVE_PHASE_STEP = 0x0a,
  WAVE_SECOND_PHASE_STEP = 0xfff8,
  WAVE_BASE_HEIGHT = 0xe8,
  WAVE_MEMBER_SPACING = 0x18,
  WAVE_MEMBER_PHASE_STEP = 0x0ffe,
  WAVE_MEMBER_SECOND_PHASE_STEP = 0x1e,
  WAVE_MEMBERS_END = 0x1a;
export const moveSwarmWave = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        k = taskSelectionSupport(h),
        read = (offset) => h.longRead(h.abs(offset)),
        write = (offset, value) => h.longWrite(h.abs(offset), value);
      const compare = (left, right) => {
        h.nz((left - right) & WORD_MASK);
        ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
      };
      const sec = () => {
          ctx.status |= FLAG_CARRY;
        },
        clc = () => {
          ctx.status &= ~FLAG_CARRY;
        };
      h.load(h.dp(FIRST_ARGUMENT));
      if (!(ctx.status & FLAG_ZERO)) {
        compare(ctx.a, 1);
        if (ctx.status & FLAG_ZERO) {
          h.load(h.dp(SECOND_ARGUMENT));
          h.asl();
          h.asl();
          h.asl();
          sec();
          h.arithmetic(h.dp(SECOND_ARGUMENT), true);
          h.arithmetic(h.dp(SECOND_ARGUMENT), true);
          h.index('y', ctx.a);
          for (const [step, target] of [
            [1, WAVE_TARGET_X],
            [2, WAVE_TARGET_Y],
            [2, WAVE_TARGET_HEIGHT],
          ]) {
            for (let n = 0; n < step; n++) h.index('y', ctx.y + 1);
            h.load(k.indirect(DP_POINT_LIST, ctx.y));
            h.asl();
            h.asl();
            write(target, ctx.a);
          }
          return;
        }
      }
      for (const [value, target] of [
        [SWARM_ORIGIN_X, WAVE_TARGET_X],
        [SWARM_ORIGIN_Y, WAVE_TARGET_Y],
      ]) {
        h.load(read(value));
        compare(ctx.a, read(target));
        if (ctx.status & FLAG_CARRY) {
          sec();
          h.arithmetic(2, true);
        } else {
          clc();
          h.arithmetic(2);
        }
        write(value, ctx.a);
      }
      for (const [from, to] of [
        [SWARM_ORIGIN_X, SWARM_X],
        [SWARM_ORIGIN_Y, SWARM_Y],
        [SWARM_ORIGIN_HEIGHT, SWARM_HEIGHT],
      ]) {
        h.load(read(from));
        write(to, ctx.a);
      }
      h.load(read(WAVE_PHASE));
      clc();
      h.arithmetic(WAVE_PHASE_STEP);
      h.load(ctx.a & PHASE_MASK);
      write(WAVE_PHASE, ctx.a);
      write(WAVE_MEMBER_PHASE, ctx.a);
      h.load(read(WAVE_SECOND_PHASE));
      clc();
      h.arithmetic(WAVE_SECOND_PHASE_STEP);
      h.load(ctx.a & PHASE_MASK);
      write(WAVE_SECOND_PHASE, ctx.a);
      write(WAVE_MEMBER_SECOND_PHASE, ctx.a);
      h.index('y', 0);
      h.index('x', 0);
      do {
        a.pushWord(ctx.y, 'd2e7-PHY');
        h.index('x', read(WAVE_MEMBER_PHASE));
        h.load(h.longRead(h.abs(WAVE_TABLE) + ctx.x));
        h.load(ctx.a & BYTE_MASK);
        write(WAVE_HEIGHT_PART, ctx.a);
        h.index('x', read(WAVE_MEMBER_SECOND_PHASE));
        h.load(h.longRead(h.abs(WAVE_TABLE) + ctx.x));
        h.load(ctx.a & BYTE_MASK);
        h.arithmetic(read(WAVE_HEIGHT_PART));
        h.index('x', h.longRead(h.abs(SWARM_MEMBERS) + ctx.y));
        clc();
        h.arithmetic(WAVE_BASE_HEIGHT);
        h.longWrite(h.abs(OBJECT_HEIGHT) + ctx.x, ctx.a);
        h.load(read(SWARM_X));
        h.longWrite(h.abs(OBJECT_X) + ctx.x, ctx.a);
        h.load(read(SWARM_Y));
        sec();
        h.arithmetic(WAVE_MEMBER_SPACING, true);
        write(SWARM_Y, ctx.a);
        h.longWrite(h.abs(OBJECT_Y) + ctx.x, ctx.a);
        h.load(read(WAVE_MEMBER_PHASE));
        clc();
        h.arithmetic(WAVE_MEMBER_PHASE_STEP);
        h.load(ctx.a & PHASE_MASK);
        write(WAVE_MEMBER_PHASE, ctx.a);
        h.load(read(WAVE_MEMBER_SECOND_PHASE));
        clc();
        h.arithmetic(WAVE_MEMBER_SECOND_PHASE_STEP);
        h.load(ctx.a & PHASE_MASK);
        write(WAVE_MEMBER_SECOND_PHASE, ctx.a);
        h.index('y', a.pullWord('d2e7-PLY'));
        h.index('y', ctx.y + 1);
        h.index('y', ctx.y + 1);
        compare(ctx.y, WAVE_MEMBERS_END);
      } while (!(ctx.status & FLAG_ZERO));
    },
    outerReturn,
  );
