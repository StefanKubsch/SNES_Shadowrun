// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setSwarmHeightSpeedTarget } from '../../src/task/native-swarm-height-speed-target.mjs';

export const prepareTaskNativeD997 = (options) =>
  prepareTaskPlan(options, [0x80d997], (a) => setSwarmHeightSpeedTarget(a));
