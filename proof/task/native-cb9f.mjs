// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setActorStateFlags } from '../../src/task/native-record-flags-set.mjs';

export const prepareTaskNativeCB9F = (options) =>
  prepareTaskPlan(options, [0x80cb9f], (a) => setActorStateFlags(a));
