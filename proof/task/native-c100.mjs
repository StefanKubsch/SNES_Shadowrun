// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getGloveScreenY } from '../../src/task/native-glove-screen-y.mjs';

export const prepareTaskNativeC100 = (options) =>
  prepareTaskPlan(options, [0x80c100], (a) => getGloveScreenY(a));
