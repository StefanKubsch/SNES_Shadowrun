// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { decrementObjectStateCountReference } from '../game-reference/actor-state.mjs';

export const prepareTaskNative9DC8 = (options) =>
  prepareTaskPlan(options, [0x809dc8], (a) => decrementObjectStateCountReference(a));
