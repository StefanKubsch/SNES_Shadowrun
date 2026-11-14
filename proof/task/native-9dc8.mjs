// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { decrementObjectStateCount } from '../../src/task/native-object-record-count-decrement.mjs';

export const prepareTaskNative9DC8 = (options) =>
  prepareTaskPlan(options, [0x809dc8], (a) => decrementObjectStateCount(a));
