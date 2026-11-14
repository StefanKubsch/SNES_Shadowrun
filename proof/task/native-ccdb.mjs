// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { addNuyen } from '../../src/task/native-nuyen-add.mjs';

export const prepareTaskNativeCCDB = (options) =>
  prepareTaskPlan(options, [0x80ccdb], (a) => addNuyen(a));
