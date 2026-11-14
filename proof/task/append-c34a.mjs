// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { appendScriptTask } from '../../src/task/task-append.mjs';

export const prepareTaskAppendC34A = (options) =>
  prepareTaskPlan(options, [0x80c34a], (a) => appendScriptTask(a));
