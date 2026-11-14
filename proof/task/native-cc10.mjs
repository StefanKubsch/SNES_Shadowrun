// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setScriptVariable } from '../../src/task/native-script-variable-set.mjs';

export const prepareTaskNativeCC10 = (options) =>
  prepareTaskPlan(options, [0x80cc10], (a) => setScriptVariable(a));
