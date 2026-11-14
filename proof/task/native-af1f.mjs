// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { drawJakeStateBar, af1fRegisters as registers } from '../../src/task/native-bar-tiles.mjs';

export const prepareTaskNativeAF1F = (options) =>
  prepareTaskPlan(options, [0x81af1f], (a) => drawJakeStateBar(a), registers);
