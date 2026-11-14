// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { keepObjectRecordFlagBits } from '../../src/task/native-object-record-flags-and.mjs';

export const prepareTaskNativeCACA = (options) =>
  prepareTaskPlan(options, [0x80caca], (a) => keepObjectRecordFlagBits(a));
