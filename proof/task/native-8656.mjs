// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { isInFightList } from '../../src/task/native-fight-list-contains.mjs';

export const prepareTaskNative8656 = (options) =>
  prepareTaskPlan(options, [0x808656], (a) => isInFightList(a));
