// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { moveSwarmWave } from '../../src/task/native-swarm-wave.mjs';

export const prepareTaskNativeD2E7 = (options) =>
  prepareTaskPlan(options, [0x80d2e7], (a) => moveSwarmWave(a));
