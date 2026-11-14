// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setObjectRecordFlagBitsReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeCAB4 = (options) =>
  prepareTaskPlan(options, [0x80cab4], (a) => setObjectRecordFlagBitsReference(a));
