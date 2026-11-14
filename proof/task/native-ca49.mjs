// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectRecordCount } from '../../src/task/native-object-record-count.mjs';

export const prepareTaskNativeCA49 = (options) =>
  prepareTaskPlan(options, [0x80ca49], (a) => getObjectRecordCount(a));
