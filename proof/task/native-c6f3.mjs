// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { moveObjectStraightToObjectReference } from '../game-reference/motion-targets.mjs';

export const prepareTaskNativeC6F3 = (options) =>
  prepareTaskPlan(options, [0x80c6f3], (a) => moveObjectStraightToObjectReference(a));
