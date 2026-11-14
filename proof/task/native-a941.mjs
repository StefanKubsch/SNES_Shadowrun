// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getObjectVelocityXReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeA941 = (options) =>
  prepareTaskPlan(options, [0x80a941], (a) => getObjectVelocityXReference(a));
