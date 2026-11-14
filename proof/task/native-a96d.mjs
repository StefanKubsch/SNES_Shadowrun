// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectCoarseHeight } from '../../src/task/native-object-height.mjs';

export const prepareTaskNativeA96D = (options) =>
  prepareTaskPlan(options, [0x80a96d], (a) => getObjectCoarseHeight(a));
