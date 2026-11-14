// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { isTimerRunning } from '../../src/task/native-timer-running.mjs';

export const prepareTaskNativeE262 = (options) =>
  prepareTaskPlan(options, [0x80e262], (a) => isTimerRunning(a));
