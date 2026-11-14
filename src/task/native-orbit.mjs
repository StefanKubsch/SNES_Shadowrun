import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { lsr, clc, WAVE_TABLE, PHASE_MASK, QUARTER_PHASE } from './native-object-bob.mjs';
import { OBJECT_HEIGHT, OBJECT_X, SWARM_MEMBERS } from './wram.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';
import { BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';
// 80:D796, the shared body of the orbit entries D769, D76F, D775, D77B, D781, D787, D78D
// and D793 (LDY #2k, JMP D796; D793 falls through): advance the object (first argument)
// one step on its orbit in phase slot Y. Phase SWARM_MEMBERS+Y += 8 mod 200; wave byte
// b at the phase, 2b (below 28: 28 + (28-2b)/2) + 174 to the height; the wave byte a
// quarter period later + 648 to the X position.
const ORBIT_PHASE_STEP = 8,
  ORBIT_LOW_LIMIT = 0x28,
  ORBIT_BASE_HEIGHT = 0x174,
  ORBIT_BASE_X = 0x648;
export const advanceOrbit = (a, slot, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h;
      h.index('y', slot);
      h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(h.longRead(h.abs(SWARM_MEMBERS) + ctx.y));
      clc(h);
      h.arithmetic(ORBIT_PHASE_STEP);
      h.load(ctx.a & PHASE_MASK);
      h.longWrite(h.abs(SWARM_MEMBERS) + ctx.y, ctx.a);
      h.index('y', ctx.a);
      h.load(h.longRead(h.abs(WAVE_TABLE) + ctx.y));
      h.load(ctx.a & BYTE_MASK);
      h.asl();
      // CMP #$0028 / BCS.
      h.nz((ctx.a - ORBIT_LOW_LIMIT) & WORD_MASK);
      ctx.status = (ctx.status & ~FLAG_CARRY) | Number(ctx.a >= ORBIT_LOW_LIMIT);
      if (!(ctx.status & FLAG_CARRY)) {
        ctx.status |= FLAG_CARRY;
        h.arithmetic(ORBIT_LOW_LIMIT, true);
        h.load(ctx.a ^ WORD_MASK);
        h.load((ctx.a + 1) & WORD_MASK);
        lsr(h);
        clc(h);
        h.arithmetic(ORBIT_LOW_LIMIT);
      }
      clc(h);
      h.arithmetic(ORBIT_BASE_HEIGHT);
      h.longWrite(h.abs(OBJECT_HEIGHT) + ctx.x, ctx.a);
      h.load(ctx.y);
      clc(h);
      h.arithmetic(QUARTER_PHASE);
      h.load(ctx.a & PHASE_MASK);
      h.index('y', ctx.a);
      h.load(h.longRead(h.abs(WAVE_TABLE) + ctx.y));
      h.load(ctx.a & BYTE_MASK);
      clc(h);
      h.arithmetic(ORBIT_BASE_X);
      h.longWrite(h.abs(OBJECT_X) + ctx.x, ctx.a);
    },
    outerReturn,
  );
// Entry -> phase slot Y: the n-th entry loads Y = 2n.
export const D796_ENTRIES = Object.freeze(
  new Map(
    [0x80d769, 0x80d76f, 0x80d775, 0x80d77b, 0x80d781, 0x80d787, 0x80d78d, 0x80d793].map(
      (entry, n) => [entry, 2 * n],
    ),
  ),
);
