// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getDirectionToPlayer } from '../../src/task/native-player-direction.mjs';

export const prepareTaskNativeD1DD = (options) =>
  prepareTaskPlan(options, [0x80d1dd], (a) => getDirectionToPlayer(a));
