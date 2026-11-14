// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectRecordCount } from '../../src/task/native-object-record-count-set.mjs';

export const prepareTaskNativeCAE0 = (options) =>
  prepareTaskPlan(options, [0x80cae0], (a) => setObjectRecordCount(a));
