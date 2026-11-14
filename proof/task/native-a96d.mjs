// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getObjectCoarseHeightReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeA96D = (options) =>
  prepareTaskPlan(options, [0x80a96d], (a) => getObjectCoarseHeightReference(a));
