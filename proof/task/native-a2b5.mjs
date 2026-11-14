// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { removeGroupMember } from '../../src/task/native-group-remove.mjs';

export const prepareTaskNativeA2B5 = (options) =>
  prepareTaskPlan(options, [0x80a2b5], (a) => removeGroupMember(a));
