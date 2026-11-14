// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { turnObjectToObject } from '../../src/task/native-object-face-object.mjs';

export const prepareTaskNativeCF93 = (options) =>
  prepareTaskPlan(options, [0x80cf93], (a) => turnObjectToObject(a));
