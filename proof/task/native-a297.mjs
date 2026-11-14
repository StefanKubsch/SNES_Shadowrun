// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getGroupMemberPosition } from '../../src/task/native-group-member-position.mjs';

export const prepareTaskNativeA297 = (options) =>
  prepareTaskPlan(options, [0x80a297], (a) => getGroupMemberPosition(a));
