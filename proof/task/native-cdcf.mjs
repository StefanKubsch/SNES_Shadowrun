// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { endDialog } from '../../src/task/native-dialog-end.mjs';

export const prepareTaskNativeCDCF = (options) =>
  prepareTaskPlan(options, [0x80cdcf], (a) => endDialog(a));
