// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectRecordFlags } from '../../src/task/native-object-record-flags.mjs';

export const prepareTaskNativeCA3A = (options) =>
  prepareTaskPlan(options, [0x80ca3a], (a) => getObjectRecordFlags(a));
