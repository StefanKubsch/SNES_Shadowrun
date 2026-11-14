// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { startWaveSwarm } from '../../src/task/native-swarm-start.mjs';

export const prepareTaskNativeD260 = (options) =>
  prepareTaskPlan(options, [0x80d260], (a) => startWaveSwarm(a));
