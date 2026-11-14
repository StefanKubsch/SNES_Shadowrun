// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setSpriteMode } from '../../src/task/native-sprite-mode-set.mjs';

export const prepareTaskNativeD16D = (options) =>
  prepareTaskPlan(options, [0x80d16d], (a) => setSpriteMode(a));
