// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { bindObjectToCurrentTask } from '../../src/task/native-object-task-bind.mjs';

export const prepareTaskNativeA926 = (options) =>
  prepareTaskPlan(options, [0x80a926], (a) => bindObjectToCurrentTask(a));
