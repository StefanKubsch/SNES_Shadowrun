// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { advanceOrbitSlot6 } from '../../src/task/native-orbit-slot-6.mjs';

export const prepareTaskNativeD787 = (options) =>
  prepareTaskPlan(options, [0x80d787], (a) => advanceOrbitSlot6(a));
