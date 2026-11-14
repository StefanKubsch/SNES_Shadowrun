// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { enterMatrix } from '../../src/task/native-matrix-enter.mjs';

export const prepareTaskNativeE30F = (options) =>
  prepareTaskPlan(options, [0x80e30f], (a) => enterMatrix(a));
