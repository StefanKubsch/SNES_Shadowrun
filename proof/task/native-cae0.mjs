// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setObjectRecordCountReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeCAE0 = (options) =>
  prepareTaskPlan(options, [0x80cae0], (a) => setObjectRecordCountReference(a));
