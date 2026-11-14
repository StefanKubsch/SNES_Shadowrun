// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getDistanceBetweenObjects } from '../../src/task/native-object-distance-direct.mjs';

export const prepareTaskNativeC694 = (options) =>
  prepareTaskPlan(options, [0x80c694], (a) => getDistanceBetweenObjects(a));
