// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getPreviousFightObject } from '../../src/task/native-fight-list-previous.mjs';

export const prepareTaskNative8631 = (options) =>
  prepareTaskPlan(options, [0x808631], (a) => getPreviousFightObject(a));
