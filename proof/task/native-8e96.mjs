// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { haltObject } from '../../src/task/native-object-halt-set.mjs';

export const prepareTaskNative8E96 = (options) =>
  prepareTaskPlan(options, [0x808e96], (a) => haltObject(a));
