// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getSpriteMode } from '../../src/task/native-sprite-mode-get.mjs';

export const prepareTaskNativeD17B = (options) =>
  prepareTaskPlan(options, [0x80d17b], (a) => getSpriteMode(a));
