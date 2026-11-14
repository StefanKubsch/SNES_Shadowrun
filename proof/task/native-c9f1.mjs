// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectKindValue } from '../../src/task/native-object-kind-attribute.mjs';

export const prepareTaskNativeC9F1 = (options) =>
  prepareTaskPlan(options, [0x80c9f1], (a) => getObjectKindValue(a));
