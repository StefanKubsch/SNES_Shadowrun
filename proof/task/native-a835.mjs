// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { createObject } from '../../src/task/native-object-create.mjs';

export const prepareTaskNativeA835 = (options) =>
  prepareTaskPlan(options, [0x80a835], (a) => createObject(a));
