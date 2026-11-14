// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { advanceOrbitSlot1 } from '../../src/task/native-orbit-slot-1.mjs';

export const prepareTaskNativeD769 = (options) =>
  prepareTaskPlan(options, [0x80d769], (a) => advanceOrbitSlot1(a));
