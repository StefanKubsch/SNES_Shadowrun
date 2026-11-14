// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectRecordFirstByte } from '../../src/task/native-object-record-byte0.mjs';

export const prepareTaskNativeCA2B = (options) =>
  prepareTaskPlan(options, [0x80ca2b], (a) => getObjectRecordFirstByte(a));
