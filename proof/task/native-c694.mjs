// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getDistanceBetweenObjectsReference } from '../game-reference/script-measures.mjs';

export const prepareTaskNativeC694 = (options) =>
  prepareTaskPlan(options, [0x80c694], (a) => getDistanceBetweenObjectsReference(a));
