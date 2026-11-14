import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import {
  BOB_OBJECT,
  BOB_PHASE,
  BOB_SECOND_OBJECT,
  BOB_SECOND_PHASE,
  OBJECT_HEIGHT,
} from './wram.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';
// 80:D714 and 80:D73B bob an object up and down, one step per call: the object (first
// argument) goes to BOB_OBJECT (BOB_SECOND_OBJECT) at DBR; its phase BOB_PHASE
// (BOB_SECOND_PHASE) += 20 mod 200; the wave byte at the phase (D73B: phase + 100 mod
// 200, half a period later) / 8 + 160 becomes the object's height.
export const lsr = (h) => {
  h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | (h.ctx.a & 1);
  h.load(h.ctx.a >>> 1);
};
export const clc = (h) => {
  h.ctx.status &= ~FLAG_CARRY;
};
// Wave table 80:D3D1 of the bobbing, swarm and orbit natives (also the colour ramp of 80:8877):
// one byte per phase 0 to 1FF; 80 is a quarter and 100 half of the table.
export const WAVE_TABLE = 0xd3d1,
  PHASE_MASK = 0x1ff,
  WAVE_WORD_INDEX_MASK = 0x1fe,
  QUARTER_PHASE = 0x80,
  HALF_PHASE = 0x100;
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
export const bobObject = (a, outerReturn = true) =>
  bob(a, BOB_OBJECT, BOB_PHASE, false, outerReturn);
// 80:D73B: bob the object (first argument) by the second bob phase, half a period later.
export const bobSecondObject = (a, outerReturn = true) =>
  bob(a, BOB_SECOND_OBJECT, BOB_SECOND_PHASE, true, outerReturn);
