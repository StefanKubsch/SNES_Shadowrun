// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectDirection } from '../../src/task/native-object-direction.mjs';

export const prepareTaskNativeD255 = (options) =>
  prepareTaskPlan(options, [0x80d255], (a) => getObjectDirection(a));
