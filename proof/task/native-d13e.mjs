// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { clearObjectVelocity } from '../../src/task/native-object-velocity-clear.mjs';

export const prepareTaskNativeD13E = (options) =>
  prepareTaskPlan(options, [0x80d13e], (a) => clearObjectVelocity(a));
