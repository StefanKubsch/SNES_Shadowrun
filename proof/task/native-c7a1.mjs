// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { moveObjectToPoint } from '../../src/task/native-motion-point-move.mjs';

export const prepareTaskNativeC7A1 = (options) =>
  prepareTaskPlan(options, [0x80c7a1], (a) => moveObjectToPoint(a));
