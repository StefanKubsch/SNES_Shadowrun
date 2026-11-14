// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getDistanceToPlayer } from '../../src/task/native-object-distance.mjs';

export const prepareTaskNativeC68D = (options) =>
  prepareTaskPlan(options, [0x80c68d], (a) => getDistanceToPlayer(a));
