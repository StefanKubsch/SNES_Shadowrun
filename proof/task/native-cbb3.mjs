// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setActorStateFlagBitsReference } from '../game-reference/actor-state.mjs';

export const prepareTaskNativeCBB3 = (options) =>
  prepareTaskPlan(options, [0x80cbb3], (a) => setActorStateFlagBitsReference(a));
