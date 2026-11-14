// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getGloveScreenX } from '../../src/task/native-glove-screen-x.mjs';

export const prepareTaskNativeC0F7 = (options) =>
  prepareTaskPlan(options, [0x80c0f7], (a) => getGloveScreenX(a));
