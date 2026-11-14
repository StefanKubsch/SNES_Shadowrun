// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { keepScriptVariableBits } from '../../src/task/native-script-variable-and.mjs';

export const prepareTaskNativeCC26 = (options) =>
  prepareTaskPlan(options, [0x80cc26], (a) => keepScriptVariableBits(a));
