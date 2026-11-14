// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { turnObjectToPlayer } from '../../src/task/native-player-direction-slot.mjs';

export const prepareTaskNativeD1D2 = (options) =>
  prepareTaskPlan(options, [0x80d1d2], (a) => turnObjectToPlayer(a));
