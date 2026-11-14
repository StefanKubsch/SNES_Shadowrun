// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getPlayerObjectReference } from '../game-reference/script-queries.mjs';

export const prepareTaskNativeCD97 = (options) =>
  prepareTaskPlan(options, [0x80cd97], (a) => getPlayerObjectReference(a));
