// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { moveObjectStraightToObject } from '../../src/task/native-motion-object-follow.mjs';

export const prepareTaskNativeC6F3 = (options) =>
  prepareTaskPlan(options, [0x80c6f3], (a) => moveObjectStraightToObject(a));
