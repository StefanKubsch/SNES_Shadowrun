// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { startSwarmOrbitReference } from '../game-reference/swarm-setup.mjs';

export const prepareTaskNativeD604 = (options) =>
  prepareTaskPlan(options, [0x80d604], (a) => startSwarmOrbitReference(a));
