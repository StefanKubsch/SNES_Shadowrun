// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { hasObjectRecordProperty } from '../../src/task/native-object-record-property-test.mjs';

export const prepareTaskNative9D98 = (options) =>
  prepareTaskPlan(options, [0x809d98], (a) => hasObjectRecordProperty(a));
