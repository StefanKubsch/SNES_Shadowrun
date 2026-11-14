// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { moveSwarmAlongPath } from '../../src/task/native-swarm-follow-path.mjs';

export const prepareTaskNativeD85B = (options) =>
  prepareTaskPlan(options, [0x80d85b], (a) => moveSwarmAlongPath(a));
