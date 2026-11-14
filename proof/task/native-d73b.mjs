// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { bobSecondObjectReference } from '../game-reference/object-bob.mjs';

export const prepareTaskNativeD73B = (options) =>
  prepareTaskPlan(options, [0x80d73b], (a) => bobSecondObjectReference(a));
