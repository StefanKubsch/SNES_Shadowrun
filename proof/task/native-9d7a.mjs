// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { resetObjectRecordProperty } from '../../src/task/native-object-record-property-reset.mjs';

export const prepareTaskNative9D7A = (options) =>
  prepareTaskPlan(options, [0x809d7a], (a) => resetObjectRecordProperty(a));
