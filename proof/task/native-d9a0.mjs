// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { requestMainLoopExit } from '../../src/task/native-main-loop-exit.mjs';

export const prepareTaskNativeD9A0 = (options) =>
  prepareTaskPlan(options, [0x80d9a0], (a) => requestMainLoopExit(a));
