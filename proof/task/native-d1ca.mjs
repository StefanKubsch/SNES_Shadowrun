// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectNumber } from '../../src/task/native-object-number.mjs';

export const prepareTaskNativeD1CA = (options) =>
  prepareTaskPlan(options, [0x80d1ca], (a) => getObjectNumber(a));
