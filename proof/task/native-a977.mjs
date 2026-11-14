// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { addObjectHeight } from '../../src/task/native-object-height-add.mjs';

export const prepareTaskNativeA977 = (options) =>
  prepareTaskPlan(options, [0x80a977], (a) => addObjectHeight(a));
