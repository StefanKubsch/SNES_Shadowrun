// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { learnSpell } from '../../src/task/native-spell-add.mjs';

export const prepareTaskNativeE1B3 = (options) =>
  prepareTaskPlan(options, [0x80e1b3], (a) => learnSpell(a));
