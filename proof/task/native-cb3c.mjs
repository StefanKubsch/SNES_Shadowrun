// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getActorStateCount } from '../../src/task/native-record-count-get.mjs';

export const prepareTaskNativeCB3C = (options) =>
  prepareTaskPlan(options, [0x80cb3c], (a) => getActorStateCount(a));
