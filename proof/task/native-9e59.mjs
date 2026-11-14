// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getPadHeldReference } from '../game-reference/script-queries.mjs';

export const prepareTaskNative9E59 = (options) =>
  prepareTaskPlan(options, [0x809e59], (a) => getPadHeldReference(a));
