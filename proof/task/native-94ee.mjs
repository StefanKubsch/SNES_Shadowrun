// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setObjectDialogReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNative94EE = (options) =>
  prepareTaskPlan(options, [0x8094ee], (a) => setObjectDialogReference(a));
