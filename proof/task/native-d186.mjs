// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getPlayerObjectAfterBreak } from '../../src/task/native-player-object-break.mjs';

export const prepareTaskNativeD186 = (options) =>
  prepareTaskPlan(options, [0x80d186], (a) => getPlayerObjectAfterBreak(a));
