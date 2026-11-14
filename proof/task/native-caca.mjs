// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { keepObjectRecordFlagBitsReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeCACA = (options) =>
  prepareTaskPlan(options, [0x80caca], (a) => keepObjectRecordFlagBitsReference(a));
