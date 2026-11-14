// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getPadPressed } from '../../src/task/native-pad-pressed.mjs';

export const prepareTaskNative9E5F = (options) =>
  prepareTaskPlan(options, [0x809e5f], (a) => getPadPressed(a));
