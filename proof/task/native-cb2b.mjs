// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getActorStateFlags } from '../../src/task/native-record-flags-get.mjs';

export const prepareTaskNativeCB2B = (options) =>
  prepareTaskPlan(options, [0x80cb2b], (a) => getActorStateFlags(a));
