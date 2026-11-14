// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectDialog } from '../../src/task/native-object-dialog-set.mjs';

export const prepareTaskNative94EE = (options) =>
  prepareTaskPlan(options, [0x8094ee], (a) => setObjectDialog(a));
