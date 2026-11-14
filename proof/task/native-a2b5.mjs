// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { removeGroupMemberReference } from '../game-reference/group-members.mjs';

export const prepareTaskNativeA2B5 = (options) =>
  prepareTaskPlan(options, [0x80a2b5], (a) => removeGroupMemberReference(a));
