// Register-level references of the swarm motion natives 80:D85B (along a path) and
// 80:D2E7 (as a wave), moved from src/script/native-swarm-follow-path.mjs and
// native-swarm-wave.mjs; lifted in src/game/swarm-motion.mjs. The proof plans, the Native58
// dispatch of proof/task/native-dispatch.mjs and the instruction tests run these; the game
// runs the lifted natives.
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from '../../src/system/native-leaf-support.mjs';
import { taskSelectionSupport } from '../script/native-object-turn.mjs';
import { lsr, clc } from '../../src/script/native-object-bob.mjs';
import { WAVE_TABLE, PHASE_MASK, QUARTER_PHASE } from '../../src/game/object-bob.mjs';
import {
  OBJECT_HEIGHT,
  OBJECT_X,
  OBJECT_Y,
  PATH_PHASE_HEIGHT,
  PATH_PHASE_XY,
  PATH_SPEED_HEIGHT,
  PATH_SPEED_HEIGHT_GOAL,
  PATH_SPEED_XY,
  PATH_SPEED_XY_GOAL,
  PATH_START_HEIGHT,
  PATH_START_HEIGHT_GOAL,
  PATH_START_XY,
  PATH_START_XY_GOAL,
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
} from '../../src/data/wram.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { WORD_MASK, BYTE_MASK } from '../../src/constants/bits.mjs';
// 80:D85B (no argument): move the swarm along its path. Five objects 1CEF+Y (Y = 0..8) follow a swinging path. Start 1D23 = 2*1D0B,
// 1D25 = 2*1D0D, 1D27 = 4*1D0F, phases 1D39/1D3B from 1D3D/1D3F. Per object the bytes of the table D3D1 at
// phase 1D39 (x), 1D39+80 (y) and 1D3B (height) minus 40 are added to 1D23/1D25/1D27; halved (height
// quartered) they go to 0E28/0E80/0ED8 of the object. The phases advance by D3D1[1D29]/4 - 10 and
// D3D1[1D2D]/2 - 20 (phase 80 read as 81). Then 1D29, 1D2D, 1D3F and 1D3D step by 2 towards 1D45, 1D47,
// 1D41 and 1D43.
const WAVE_CENTRE = 0x40,
  XY_PHASE_BIAS = 0x10,
  HEIGHT_PHASE_BIAS = 0x20,
  PATH_MEMBERS_END = 0x0a;
export const moveSwarmAlongPathReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h,
        read = (offset) => h.longRead(h.abs(offset)),
        write = (offset, value) => h.longWrite(h.abs(offset), value);
      const compare = (left, right) => {
        h.nz((left - right) & WORD_MASK);
        ctx.status = (ctx.status & ~FLAG_CARRY) | Number(left >= right);
      };
      const table = () => {
        h.index('x', ctx.a);
        h.load(h.longRead(h.abs(WAVE_TABLE) + ctx.x));
        h.load(ctx.a & BYTE_MASK);
      };
      h.load(read(SWARM_ORIGIN_X));
      h.asl();
      write(SWARM_X, ctx.a);
      h.load(read(SWARM_ORIGIN_Y));
      h.asl();
      write(SWARM_Y, ctx.a);
      h.load(read(SWARM_ORIGIN_HEIGHT));
      h.asl();
      h.asl();
      write(SWARM_HEIGHT, ctx.a);
      h.load(read(PATH_START_XY));
      write(PATH_PHASE_XY, ctx.a);
      h.load(read(PATH_START_HEIGHT));
      write(PATH_PHASE_HEIGHT, ctx.a);
      h.index('y', 0);
      do {
        const axis = (phase, sum, target, shifts) => {
          phase();
          table();
          ctx.status |= FLAG_CARRY;
          h.arithmetic(WAVE_CENTRE, true);
          clc(h);
          h.arithmetic(read(sum));
          write(sum, ctx.a);
          h.index('x', h.longRead(h.abs(SWARM_MEMBERS) + ctx.y));
          for (let n = 0; n < shifts; n++) lsr(h);
          h.longWrite(h.abs(target) + ctx.x, ctx.a);
        };
        axis(
          () => {
            h.load(read(PATH_PHASE_XY));
            h.load(ctx.a & PHASE_MASK);
          },
          SWARM_X,
          OBJECT_X,
          1,
        );
        axis(
          () => {
            h.load(read(PATH_PHASE_XY));
            clc(h);
            h.arithmetic(QUARTER_PHASE);
            h.load(ctx.a & PHASE_MASK);
          },
          SWARM_Y,
          OBJECT_Y,
          1,
        );
        axis(
          () => {
            h.load(read(PATH_PHASE_HEIGHT));
            h.load(ctx.a & PHASE_MASK);
          },
          SWARM_HEIGHT,
          OBJECT_HEIGHT,
          2,
        );
        const advance = (speed, shifts, offset, phase) => {
          h.load(read(speed));
          h.load(ctx.a & PHASE_MASK);
          compare(ctx.a, QUARTER_PHASE);
          if (ctx.status & FLAG_ZERO) h.load(QUARTER_PHASE + 1);
          table();
          for (let n = 0; n < shifts; n++) lsr(h);
          ctx.status |= FLAG_CARRY;
          h.arithmetic(offset, true);
          clc(h);
          h.arithmetic(read(phase));
          write(phase, ctx.a);
        };
        advance(PATH_SPEED_XY, 2, XY_PHASE_BIAS, PATH_PHASE_XY);
        advance(PATH_SPEED_HEIGHT, 1, HEIGHT_PHASE_BIAS, PATH_PHASE_HEIGHT);
        h.index('y', ctx.y + 1);
        h.index('y', ctx.y + 1);
        compare(ctx.y, PATH_MEMBERS_END);
      } while (!(ctx.status & FLAG_ZERO));
      for (const [value, goal] of [
        [PATH_SPEED_XY, PATH_SPEED_XY_GOAL],
        [PATH_SPEED_HEIGHT, PATH_SPEED_HEIGHT_GOAL],
        [PATH_START_HEIGHT, PATH_START_HEIGHT_GOAL],
        [PATH_START_XY, PATH_START_XY_GOAL],
      ]) {
        h.load(read(value));
        compare(ctx.a, read(goal));
        if (ctx.status & FLAG_ZERO) continue;
        if (ctx.status & FLAG_CARRY) {
          h.load(ctx.a - 1);
          h.load(ctx.a - 1);
        } else {
          h.load(ctx.a + 1);
          h.load(ctx.a + 1);
        }
        write(value, ctx.a);
      }
    },
    outerReturn,
  );
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
export const moveSwarmWaveReference = (a, outerReturn = true) =>
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
