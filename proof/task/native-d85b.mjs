// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { moveSwarmAlongPathReference } from '../game-reference/swarm-motion.mjs';

export const prepareTaskNativeD85B = (options) =>
  prepareTaskPlan(options, [0x80d85b], (a) => moveSwarmAlongPathReference(a));
