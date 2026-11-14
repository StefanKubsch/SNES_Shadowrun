// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { hasFightTarget } from '../../src/task/native-fight-list-any-active.mjs';

export const prepareTaskNative866F = (options) =>
  prepareTaskPlan(options, [0x80866f], (a) => hasFightTarget(a));
