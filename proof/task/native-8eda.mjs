// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { appendSelectedSpellTask } from '../../src/task/native-task-append-from-list.mjs';

export const prepareTaskNative8EDA = (options) =>
  prepareTaskPlan(options, [0x808eda], (a) => appendSelectedSpellTask(a));
