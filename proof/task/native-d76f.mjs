// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { advanceOrbitSlot2 } from '../../src/task/native-orbit-slot-2.mjs';

export const prepareTaskNativeD76F = (options) =>
  prepareTaskPlan(options, [0x80d76f], (a) => advanceOrbitSlot2(a));
