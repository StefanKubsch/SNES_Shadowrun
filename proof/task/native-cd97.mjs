// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getPlayerObject } from '../../src/task/native-player-object.mjs';

export const prepareTaskNativeCD97 = (options) =>
  prepareTaskPlan(options, [0x80cd97], (a) => getPlayerObject(a));
