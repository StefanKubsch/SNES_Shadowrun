// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { startTimer } from '../../src/task/native-timer-start.mjs';

export const prepareTaskNativeE255 = (options) =>
  prepareTaskPlan(options, [0x80e255], (a) => startTimer(a));
