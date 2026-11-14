// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getPadHeld } from '../../src/task/native-pad-held.mjs';

export const prepareTaskNative9E59 = (options) =>
  prepareTaskPlan(options, [0x809e59], (a) => getPadHeld(a));
