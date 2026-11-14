// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { keepObjectFlagBitsReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeCA20 = (options) =>
  prepareTaskPlan(options, [0x80ca20], (a) => keepObjectFlagBitsReference(a));
