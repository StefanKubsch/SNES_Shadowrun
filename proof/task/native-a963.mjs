// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectCoarseY } from '../../src/task/native-object-position-y.mjs';

export const prepareTaskNativeA963 = (options) =>
  prepareTaskPlan(options, [0x80a963], (a) => getObjectCoarseY(a));
