// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getObjectRecordCountReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeCA49 = (options) =>
  prepareTaskPlan(options, [0x80ca49], (a) => getObjectRecordCountReference(a));
