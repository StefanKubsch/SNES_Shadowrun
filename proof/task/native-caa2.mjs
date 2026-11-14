// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setObjectRecordFlagsReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeCAA2 = (options) =>
  prepareTaskPlan(options, [0x80caa2], (a) => setObjectRecordFlagsReference(a));
