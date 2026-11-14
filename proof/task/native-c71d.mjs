// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { moveObjectToPlayer } from '../../src/task/native-motion-player-move.mjs';

export const prepareTaskNativeC71D = (options) =>
  prepareTaskPlan(options, [0x80c71d], (a) => moveObjectToPlayer(a));
