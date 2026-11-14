// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { advanceOrbitSlot3 } from '../../src/task/native-orbit-slot-3.mjs';

export const prepareTaskNativeD775 = (options) =>
  prepareTaskPlan(options, [0x80d775], (a) => advanceOrbitSlot3(a));
