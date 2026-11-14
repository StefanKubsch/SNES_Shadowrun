// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setScriptVariableBits } from '../../src/task/native-script-variable-or.mjs';

export const prepareTaskNativeCC19 = (options) =>
  prepareTaskPlan(options, [0x80cc19], (a) => setScriptVariableBits(a));
