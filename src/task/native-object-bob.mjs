import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { bobObject as bob } from '../game/object-bob.mjs';
import { FLAG_CARRY } from '../constants/cpu-flags.mjs';
// 80:D714 and 80:D73B (lifted in src/game/object-bob.mjs; register-level references in
// proof/game-reference/object-bob.mjs) bob an object up and down, one step per call.
// The register helpers below serve the register-level natives of other modules.
export const lsr = (h) => {
  h.ctx.status = (h.ctx.status & ~FLAG_CARRY) | (h.ctx.a & 1);
  h.load(h.ctx.a >>> 1);
};
export const clc = (h) => {
  h.ctx.status &= ~FLAG_CARRY;
};
// The wave table constants, defined with the lifted natives.
export {
  WAVE_TABLE,
  PHASE_MASK,
  WAVE_WORD_INDEX_MASK,
  QUARTER_PHASE,
  HALF_PHASE,
} from '../game/object-bob.mjs';
// 80:D714: bob the object (first argument) by the first bob phase.
export const bobObject = (a, outerReturn = true) => {
  bob(a.mem, leafArgument(a, FIRST_ARGUMENT), false);
  return finishLeaf(a, outerReturn);
};
// 80:D73B: bob the object (first argument) by the second bob phase, half a period later.
export const bobSecondObject = (a, outerReturn = true) => {
  bob(a.mem, leafArgument(a, FIRST_ARGUMENT), true);
  return finishLeaf(a, outerReturn);
};
