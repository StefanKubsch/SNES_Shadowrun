// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { moveObjectStraightToPlayer } from '../../src/task/native-motion-player-follow.mjs';

export const prepareTaskNativeC716 = (options) =>
  prepareTaskPlan(options, [0x80c716], (a) => moveObjectStraightToPlayer(a));
