// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { advanceOrbitReference } from '../game-reference/object-bob.mjs';

export const prepareTaskNativeD77B = (options) =>
  prepareTaskPlan(options, [0x80d77b], (a) => advanceOrbitReference(a, 6));
