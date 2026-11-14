// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { limitSpellGlove } from '../../src/task/native-glove-spell-limits.mjs';

export const prepareTaskNativeBC9C = (options) =>
  prepareTaskPlan(options, [0x80bc9c], (a) => limitSpellGlove(a));
