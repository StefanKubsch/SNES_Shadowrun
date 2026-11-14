// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { keepObjectFlagBits } from '../../src/task/native-object-flags-and.mjs';

export const prepareTaskNativeCA20 = (options) =>
  prepareTaskPlan(options, [0x80ca20], (a) => keepObjectFlagBits(a));
