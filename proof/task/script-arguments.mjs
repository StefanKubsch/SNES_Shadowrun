// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { runTaskScriptArguments } from '../../src/task/script-arguments.mjs';

export const prepareTaskScriptArguments = (options) =>
  prepareTaskPlan(options, [0x80f460], runTaskScriptArguments);
