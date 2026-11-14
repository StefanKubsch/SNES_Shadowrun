// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getObjectKindValueReference } from '../game-reference/kind-values.mjs';

export const prepareTaskNativeC9F1 = (options) =>
  prepareTaskPlan(options, [0x80c9f1], (a) => getObjectKindValueReference(a));
