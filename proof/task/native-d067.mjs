// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getRunnerStrength } from '../../src/task/native-runner-record-byte.mjs';

export const prepareTaskNativeD067 = (options) =>
  prepareTaskPlan(options, [0x80d067], (a) => getRunnerStrength(a));
