// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { resetSwarmPhases } from '../../src/task/native-swarm-phases-reset.mjs';

export const prepareTaskNativeD622 = (options) =>
  prepareTaskPlan(options, [0x80d622], (a) => resetSwarmPhases(a));
