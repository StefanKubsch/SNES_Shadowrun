// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setActorStateFlagsReference } from '../game-reference/actor-state.mjs';

export const prepareTaskNativeCB9F = (options) =>
  prepareTaskPlan(options, [0x80cb9f], (a) => setActorStateFlagsReference(a));
