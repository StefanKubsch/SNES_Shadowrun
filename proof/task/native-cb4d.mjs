// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getActorStatePropertyReference } from '../game-reference/actor-state.mjs';

export const prepareTaskNativeCB4D = (options) =>
  prepareTaskPlan(options, [0x80cb4d], (a) => getActorStatePropertyReference(a));
