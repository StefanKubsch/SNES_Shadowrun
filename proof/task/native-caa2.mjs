// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectRecordFlags } from '../../src/task/native-object-record-flags-set.mjs';

export const prepareTaskNativeCAA2 = (options) =>
  prepareTaskPlan(options, [0x80caa2], (a) => setObjectRecordFlags(a));
