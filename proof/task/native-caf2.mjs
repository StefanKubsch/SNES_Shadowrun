// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getActorKindValueReference } from '../game-reference/kind-values.mjs';

export const prepareTaskNativeCAF2 = (options) =>
  prepareTaskPlan(options, [0x80caf2], (a) => getActorKindValueReference(a));
