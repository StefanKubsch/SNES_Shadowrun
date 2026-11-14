// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getPlayerObjectCopy } from '../../src/task/native-player-object-second.mjs';

export const prepareTaskNativeD18A = (options) =>
  prepareTaskPlan(options, [0x80d18a], (a) => getPlayerObjectCopy(a));
