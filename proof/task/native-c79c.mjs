// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { moveObjectStraightToPoint } from '../../src/task/native-motion-point-follow.mjs';

export const prepareTaskNativeC79C = (options) =>
  prepareTaskPlan(options, [0x80c79c], (a) => moveObjectStraightToPoint(a));
