// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setSpriteModeReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeD16D = (options) =>
  prepareTaskPlan(options, [0x80d16d], (a) => setSpriteModeReference(a));
