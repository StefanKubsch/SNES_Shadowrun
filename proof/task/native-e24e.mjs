// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { stopTimer } from '../../src/task/native-timer-stop.mjs';

export const prepareTaskNativeE24E = (options) =>
  prepareTaskPlan(options, [0x80e24e], (a) => stopTimer(a));
