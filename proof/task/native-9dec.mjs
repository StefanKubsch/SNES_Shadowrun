// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { addActorStateCountReference } from '../game-reference/actor-state.mjs';

export const prepareTaskNative9DEC = (options) =>
  prepareTaskPlan(options, [0x809dec], (a) => addActorStateCountReference(a));
