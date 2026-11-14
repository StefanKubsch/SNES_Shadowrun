// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { startSwarmOrbit } from '../../src/task/native-swarm-orbit-start.mjs';

export const prepareTaskNativeD604 = (options) =>
  prepareTaskPlan(options, [0x80d604], (a) => startSwarmOrbit(a));
