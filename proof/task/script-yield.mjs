// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { runTaskScriptYield } from '../../src/task/script-yield.mjs';

export const prepareTaskScriptYield = (options) =>
  prepareTaskPlan(options, [0x80f488], (a) => runTaskScriptYield(a, options));
