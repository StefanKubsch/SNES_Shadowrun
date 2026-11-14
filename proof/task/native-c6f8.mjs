// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { moveObjectToObject } from '../../src/task/native-motion-object-move.mjs';

export const prepareTaskNativeC6F8 = (options) =>
  prepareTaskPlan(options, [0x80c6f8], (a) => moveObjectToObject(a));
