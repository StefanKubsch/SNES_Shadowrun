// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectAnimation } from '../../src/task/native-object-action-apply.mjs';

export const prepareTaskNativeA985 = (options) =>
  prepareTaskPlan(options, [0x80a985], (a) => setObjectAnimation(a));
