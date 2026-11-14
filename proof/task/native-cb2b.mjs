// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getActorStateFlagsReference } from '../game-reference/actor-state.mjs';

export const prepareTaskNativeCB2B = (options) =>
  prepareTaskPlan(options, [0x80cb2b], (a) => getActorStateFlagsReference(a));
