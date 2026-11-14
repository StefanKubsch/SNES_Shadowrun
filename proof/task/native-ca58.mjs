// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectRecordProperty } from '../../src/task/native-object-record-property.mjs';

export const prepareTaskNativeCA58 = (options) =>
  prepareTaskPlan(options, [0x80ca58], (a) => getObjectRecordProperty(a));
