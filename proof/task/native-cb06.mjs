// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getActorKindFlagsReference } from '../game-reference/kind-values.mjs';

export const prepareTaskNativeCB06 = (options) =>
  prepareTaskPlan(options, [0x80cb06], (a) => getActorKindFlagsReference(a));
