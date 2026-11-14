// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getGloveScreenXReference } from '../game-reference/script-queries.mjs';

export const prepareTaskNativeC0F7 = (options) =>
  prepareTaskPlan(options, [0x80c0f7], (a) => getGloveScreenXReference(a));
