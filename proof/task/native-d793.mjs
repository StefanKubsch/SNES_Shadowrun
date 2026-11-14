// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { advanceOrbitSlot8 } from '../../src/task/native-orbit-slot-8.mjs';

export const prepareTaskNativeD793 = (options) =>
  prepareTaskPlan(options, [0x80d793], (a) => advanceOrbitSlot8(a));
