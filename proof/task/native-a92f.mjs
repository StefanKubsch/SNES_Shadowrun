// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectVelocity } from '../../src/task/native-object-velocity-set.mjs';

export const prepareTaskNativeA92F = (options) =>
  prepareTaskPlan(options, [0x80a92f], (a) => setObjectVelocity(a));
