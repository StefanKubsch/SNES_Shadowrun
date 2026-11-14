// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { clearObjectTask } from '../../src/task/native-object-task-clear.mjs';

export const prepareTaskNativeA91D = (options) =>
  prepareTaskPlan(options, [0x80a91d], (a) => clearObjectTask(a));
