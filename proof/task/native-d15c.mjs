// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectActionAndDirection } from '../../src/task/native-object-turn.mjs';

export const prepareTaskNativeD15C = (options) =>
  prepareTaskPlan(options, [0x80d15c], (a) => setObjectActionAndDirection(a));
