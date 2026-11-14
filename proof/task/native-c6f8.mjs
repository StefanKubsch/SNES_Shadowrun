// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { moveObjectToObjectReference } from '../game-reference/motion-targets.mjs';

export const prepareTaskNativeC6F8 = (options) =>
  prepareTaskPlan(options, [0x80c6f8], (a) => moveObjectToObjectReference(a));
