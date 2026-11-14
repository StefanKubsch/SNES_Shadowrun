// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setSwarmHeightPhaseTarget } from '../../src/task/native-swarm-height-phase-target.mjs';

export const prepareTaskNativeD97C = (options) =>
  prepareTaskPlan(options, [0x80d97c], (a) => setSwarmHeightPhaseTarget(a));
