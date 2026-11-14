// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { stopMotion } from '../../src/task/native-motion-stop.mjs';

export const prepareTaskNativeC7C2 = (options) =>
  prepareTaskPlan(options, [0x80c7c2], (a) => stopMotion(a));
