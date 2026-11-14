// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { addMagicPoints } from '../../src/task/native-magic-points-add.mjs';

export const prepareTaskNative8B8A = (options) =>
  prepareTaskPlan(options, [0x808b8a], (a) => addMagicPoints(a));
