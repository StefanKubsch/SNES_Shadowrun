// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectCoarseX } from '../../src/task/native-object-position-x.mjs';

export const prepareTaskNativeA959 = (options) =>
  prepareTaskPlan(options, [0x80a959], (a) => getObjectCoarseX(a));
