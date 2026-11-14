// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { halveArgumentSigned } from '../../src/task/native-shift-right-signed.mjs';

export const prepareTaskNativeD9A7 = (options) =>
  prepareTaskPlan(options, [0x80d9a7], (a) => halveArgumentSigned(a));
