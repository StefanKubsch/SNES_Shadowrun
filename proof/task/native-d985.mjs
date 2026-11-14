// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setSwarmPathPhaseTargetReference } from '../game-reference/swarm-setup.mjs';

export const prepareTaskNativeD985 = (options) =>
  prepareTaskPlan(options, [0x80d985], (a) => setSwarmPathPhaseTargetReference(a));
