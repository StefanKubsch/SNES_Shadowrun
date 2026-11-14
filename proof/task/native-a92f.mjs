// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setObjectVelocityReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeA92F = (options) =>
  prepareTaskPlan(options, [0x80a92f], (a) => setObjectVelocityReference(a));
