// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { keepActorStateFlagBits } from '../../src/task/native-record-flags-and.mjs';

export const prepareTaskNativeCBCB = (options) =>
  prepareTaskPlan(options, [0x80cbcb], (a) => keepActorStateFlagBits(a));
