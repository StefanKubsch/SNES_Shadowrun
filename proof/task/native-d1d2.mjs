// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { turnObjectToPlayerReference } from '../game-reference/object-facing.mjs';

export const prepareTaskNativeD1D2 = (options) =>
  prepareTaskPlan(options, [0x80d1d2], (a) => turnObjectToPlayerReference(a));
