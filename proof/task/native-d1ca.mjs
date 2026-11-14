// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getObjectNumberReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeD1CA = (options) =>
  prepareTaskPlan(options, [0x80d1ca], (a) => getObjectNumberReference(a));
