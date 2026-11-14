// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectFlagBits } from '../../src/task/native-object-flags-or.mjs';

export const prepareTaskNativeCA15 = (options) =>
  prepareTaskPlan(options, [0x80ca15], (a) => setObjectFlagBits(a));
