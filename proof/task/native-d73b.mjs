// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { bobSecondObject } from '../../src/task/native-object-bob.mjs';

export const prepareTaskNativeD73B = (options) =>
  prepareTaskPlan(options, [0x80d73b], (a) => bobSecondObject(a));
