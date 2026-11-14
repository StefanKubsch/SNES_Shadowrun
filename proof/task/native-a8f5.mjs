// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { removeObjectReference } from '../game-reference/object-release.mjs';

export const prepareTaskNativeA8F5 = (options) =>
  prepareTaskPlan(options, [0x80a8f5], (a) => removeObjectReference(a));
