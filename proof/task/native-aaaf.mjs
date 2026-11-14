// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectDirection } from '../../src/task/native-object-action-set.mjs';

export const prepareTaskNativeAAAF = (options) =>
  prepareTaskPlan(options, [0x80aaaf], (a) => setObjectDirection(a));
