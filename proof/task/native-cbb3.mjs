// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setActorStateFlagBits } from '../../src/task/native-record-flags-or.mjs';

export const prepareTaskNativeCBB3 = (options) =>
  prepareTaskPlan(options, [0x80cbb3], (a) => setActorStateFlagBits(a));
