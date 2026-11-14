// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectRecordFlagBits } from '../../src/task/native-object-record-flags-or.mjs';

export const prepareTaskNativeCAB4 = (options) =>
  prepareTaskPlan(options, [0x80cab4], (a) => setObjectRecordFlagBits(a));
