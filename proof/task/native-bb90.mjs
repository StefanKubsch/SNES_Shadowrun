// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { hasNoObjectAnimation } from '../../src/task/native-object-selection-empty.mjs';

export const prepareTaskNativeBB90 = (options) =>
  prepareTaskPlan(options, [0x80bb90], (a) => hasNoObjectAnimation(a));
