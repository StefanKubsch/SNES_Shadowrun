// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { bobObject } from '../../src/task/native-object-bob.mjs';

export const prepareTaskNativeD714 = (options) =>
  prepareTaskPlan(options, [0x80d714], (a) => bobObject(a));
