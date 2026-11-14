// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { startPathSwarm } from '../../src/task/native-swarm-start.mjs';

export const prepareTaskNativeD7DD = (options) =>
  prepareTaskPlan(options, [0x80d7dd], (a) => startPathSwarm(a));
