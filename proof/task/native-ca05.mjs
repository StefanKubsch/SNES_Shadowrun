// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getObjectFlagsReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeCA05 = (options) =>
  prepareTaskPlan(options, [0x80ca05], (a) => getObjectFlagsReference(a));
