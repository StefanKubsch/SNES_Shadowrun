// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { resumeObjectReference } from '../game-reference/object-halt.mjs';

export const prepareTaskNative8EB8 = (options) =>
  prepareTaskPlan(options, [0x808eb8], (a) => resumeObjectReference(a));
