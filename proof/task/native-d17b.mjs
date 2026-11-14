// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getSpriteModeReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeD17B = (options) =>
  prepareTaskPlan(options, [0x80d17b], (a) => getSpriteModeReference(a));
