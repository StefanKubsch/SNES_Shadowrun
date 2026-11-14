// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setSwarmPathPhaseTarget } from '../../src/task/native-swarm-path-phase-target.mjs';

export const prepareTaskNativeD985 = (options) =>
  prepareTaskPlan(options, [0x80d985], (a) => setSwarmPathPhaseTarget(a));
