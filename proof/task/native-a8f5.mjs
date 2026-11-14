// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { removeObject } from '../../src/task/native-object-release.mjs';

export const prepareTaskNativeA8F5 = (options) =>
  prepareTaskPlan(options, [0x80a8f5], (a) => removeObject(a));
