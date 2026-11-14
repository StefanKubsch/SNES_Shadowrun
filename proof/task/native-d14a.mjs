// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectPosition } from '../../src/task/native-object-position-set.mjs';

export const prepareTaskNativeD14A = (options) =>
  prepareTaskPlan(options, [0x80d14a], (a) => setObjectPosition(a));
