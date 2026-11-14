// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { moveObjectStraightToWaypointReference } from '../game-reference/motion-targets.mjs';

export const prepareTaskNativeC6BF = (options) =>
  prepareTaskPlan(options, [0x80c6bf], (a) => moveObjectStraightToWaypointReference(a));
