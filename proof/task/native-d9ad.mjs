// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { startBrightnessFade } from '../../src/task/native-signed-offset-set.mjs';

export const prepareTaskNativeD9AD = (options) =>
  prepareTaskPlan(options, [0x80d9ad], (a) => startBrightnessFade(a));
