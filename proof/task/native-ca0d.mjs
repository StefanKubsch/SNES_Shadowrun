// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectFlags } from '../../src/task/native-object-flags-set.mjs';

export const prepareTaskNativeCA0D = (options) =>
  prepareTaskPlan(options, [0x80ca0d], (a) => setObjectFlags(a));
