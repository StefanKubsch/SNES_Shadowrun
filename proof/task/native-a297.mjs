// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getGroupMemberPositionReference } from '../game-reference/group-members.mjs';

export const prepareTaskNativeA297 = (options) =>
  prepareTaskPlan(options, [0x80a297], (a) => getGroupMemberPositionReference(a));
