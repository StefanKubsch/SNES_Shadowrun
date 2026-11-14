// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectRecordPropertyFromGroup } from '../../src/task/native-object-record-property-from-group.mjs';

export const prepareTaskNative9D6A = (options) =>
  prepareTaskPlan(options, [0x809d6a], (a) => setObjectRecordPropertyFromGroup(a));
