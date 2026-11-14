// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { addKarma } from '../../src/task/native-karma-add.mjs';

export const prepareTaskNativeCDB2 = (options) =>
  prepareTaskPlan(options, [0x80cdb2], (a) => addKarma(a));
