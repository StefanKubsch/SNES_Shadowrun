// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { advanceOrbitSlot4 } from '../../src/task/native-orbit-slot-4.mjs';

export const prepareTaskNativeD77B = (options) =>
  prepareTaskPlan(options, [0x80d77b], (a) => advanceOrbitSlot4(a));
