// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { updateObjectDepthMode } from '../../src/task/native-sprite-mode-from-flags.mjs';

export const prepareTaskNativeD0D3 = (options) =>
  prepareTaskPlan(options, [0x80d0d3], (a) => updateObjectDepthMode(a));
