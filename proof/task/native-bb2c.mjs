// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { placeObjectInFormationReference } from '../game-reference/formation-place.mjs';

export const prepareTaskNativeBB2C = (options) =>
  prepareTaskPlan(options, [0x80bb2c], (a) => placeObjectInFormationReference(a));
