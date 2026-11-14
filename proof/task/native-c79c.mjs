// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { moveObjectStraightToPointReference } from '../game-reference/motion-targets.mjs';

export const prepareTaskNativeC79C = (options) =>
  prepareTaskPlan(options, [0x80c79c], (a) => moveObjectStraightToPointReference(a));
