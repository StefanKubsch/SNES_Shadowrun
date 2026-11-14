// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setSwarmPathSpeedTarget } from '../../src/task/native-swarm-path-speed-target.mjs';

export const prepareTaskNativeD98E = (options) =>
  prepareTaskPlan(options, [0x80d98e], (a) => setSwarmPathSpeedTarget(a));
