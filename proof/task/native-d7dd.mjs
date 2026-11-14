// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { startPathSwarmReference } from '../game-reference/swarm-start.mjs';

export const prepareTaskNativeD7DD = (options) =>
  prepareTaskPlan(options, [0x80d7dd], (a) => startPathSwarmReference(a));
