// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getGloveScreenYReference } from '../game-reference/script-queries.mjs';

export const prepareTaskNativeC100 = (options) =>
  prepareTaskPlan(options, [0x80c100], (a) => getGloveScreenYReference(a));
