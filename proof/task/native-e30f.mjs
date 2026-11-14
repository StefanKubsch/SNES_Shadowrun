// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { enterMatrixReference } from '../game-reference/matrix-enter.mjs';

export const prepareTaskNativeE30F = (options) =>
  prepareTaskPlan(options, [0x80e30f], (a) => enterMatrixReference(a));
