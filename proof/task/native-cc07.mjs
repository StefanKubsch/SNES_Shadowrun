// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getScriptVariable } from '../../src/task/native-script-variable-get.mjs';

export const prepareTaskNativeCC07 = (options) =>
  prepareTaskPlan(options, [0x80cc07], (a) => getScriptVariable(a));
