import { leaf } from './native-leaf-support.mjs';
import { lsr, clc, WAVE_TABLE, PHASE_MASK, QUARTER_PHASE } from './native-object-bob.mjs';
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
} from './wram.mjs';
import { FLAG_CARRY, FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { WORD_MASK, BYTE_MASK } from '../constants/bits.mjs';
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
export const moveSwarmAlongPath = (a, outerReturn = true) =>
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
