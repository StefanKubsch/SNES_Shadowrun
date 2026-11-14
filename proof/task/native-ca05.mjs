// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectFlags } from '../../src/task/native-object-flags-get.mjs';

export const prepareTaskNativeCA05 = (options) =>
  prepareTaskPlan(options, [0x80ca05], (a) => getObjectFlags(a));
