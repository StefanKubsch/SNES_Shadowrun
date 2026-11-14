// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { keepActorStateFlagBitsReference } from '../game-reference/actor-state.mjs';

export const prepareTaskNativeCBCB = (options) =>
  prepareTaskPlan(options, [0x80cbcb], (a) => keepActorStateFlagBitsReference(a));
