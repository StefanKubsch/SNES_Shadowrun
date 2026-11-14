// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { limitCrosshairReference } from '../game-reference/script-measures.mjs';

export const prepareTaskNativeBC83 = (options) =>
  prepareTaskPlan(options, [0x80bc83], (a) => limitCrosshairReference(a));
