// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { advanceOrbitSlot5 } from '../../src/task/native-orbit-slot-5.mjs';

export const prepareTaskNativeD781 = (options) =>
  prepareTaskPlan(options, [0x80d781], (a) => advanceOrbitSlot5(a));
