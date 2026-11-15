// Register-level references of the bobbing and orbit script natives 80:D714, 80:D73B and
// 80:D769 to 80:D793 (moved from src/script/native-object-bob.mjs and native-orbit.mjs;
// lifted in src/game/object-bob.mjs). The proof plans, the Native58 dispatch of
// proof/task/native-dispatch.mjs and the instruction tests of
// tools/task-native-m1d.test.mjs run these; the game runs the lifted natives.
import { FIRST_ARGUMENT, leaf } from '../../src/system/native-leaf-support.mjs';
import {
  HALF_PHASE,
  PHASE_MASK,
  QUARTER_PHASE,
  WAVE_TABLE,
  clc,
  lsr,
} from '../../src/script/native-object-bob.mjs';
import {
  BOB_OBJECT,
  BOB_PHASE,
  BOB_SECOND_OBJECT,
  BOB_SECOND_PHASE,
  OBJECT_HEIGHT,
  OBJECT_X,
  SWARM_MEMBERS,
} from '../../src/data/wram.mjs';
import { FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';
import { BYTE_MASK, WORD_MASK } from '../../src/constants/bits.mjs';

const BOB_PHASE_STEP = 0x20,
  BOB_BASE_HEIGHT = 0x160;
const bob = (a, objectWord, phaseWord, shift, outerReturn) =>
  leaf(
    a,
    (h) => {
      const { ctx } = h;
      h.load(h.dp(FIRST_ARGUMENT));
      h.longWrite(h.abs(objectWord), ctx.a);
      h.load(h.longRead(h.abs(phaseWord)));
      clc(h);
      h.arithmetic(BOB_PHASE_STEP);
      h.load(ctx.a & PHASE_MASK);
      h.longWrite(h.abs(phaseWord), ctx.a);
      if (shift) {
        clc(h);
        h.arithmetic(HALF_PHASE);
        h.load(ctx.a & PHASE_MASK);
      }
      h.index('y', ctx.a);
      h.load(h.longRead(h.abs(WAVE_TABLE) + ctx.y));
      h.load(ctx.a & BYTE_MASK);
      lsr(h);
      lsr(h);
      lsr(h);
      clc(h);
      h.arithmetic(BOB_BASE_HEIGHT);
      h.index('x', h.longRead(h.abs(objectWord)));
      h.longWrite(h.abs(OBJECT_HEIGHT) + ctx.x, ctx.a);
    },
    outerReturn,
  );
// 80:D714: bob the object (first argument) by the first bob phase.
export const bobObjectReference = (a, outerReturn = true) =>
  bob(a, BOB_OBJECT, BOB_PHASE, false, outerReturn);
// 80:D73B: bob the object (first argument) by the second bob phase, half a period later.
export const bobSecondObjectReference = (a, outerReturn = true) =>
  bob(a, BOB_SECOND_OBJECT, BOB_SECOND_PHASE, true, outerReturn);
// 80:D796, the shared body of the orbit entries D769, D76F, D775, D77B, D781, D787, D78D
// and D793 (LDY #2k, JMP D796; D793 falls through): advance the object (first argument)
// one step on its orbit in phase slot Y. Phase SWARM_MEMBERS+Y += 8 mod 200; wave byte
// b at the phase, 2b (below 28: 28 + (28-2b)/2) + 174 to the height; the wave byte a
// quarter period later + 648 to the X position.
const ORBIT_PHASE_STEP = 8,
  ORBIT_LOW_LIMIT = 0x28,
  ORBIT_BASE_HEIGHT = 0x174,
  ORBIT_BASE_X = 0x648;
export const advanceOrbitReference = (a, slot, outerReturn = true) =>
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
