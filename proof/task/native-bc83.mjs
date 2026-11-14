// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { limitCrosshair } from '../../src/task/native-glove-crosshair-limits.mjs';

export const prepareTaskNativeBC83 = (options) =>
  prepareTaskPlan(options, [0x80bc83], (a) => limitCrosshair(a));
