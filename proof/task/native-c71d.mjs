// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { moveObjectToPlayerReference } from '../game-reference/motion-targets.mjs';

export const prepareTaskNativeC71D = (options) =>
  prepareTaskPlan(options, [0x80c71d], (a) => moveObjectToPlayerReference(a));
