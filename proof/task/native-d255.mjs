// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getObjectDirectionReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeD255 = (options) =>
  prepareTaskPlan(options, [0x80d255], (a) => getObjectDirectionReference(a));
