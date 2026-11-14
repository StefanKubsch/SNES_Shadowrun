// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setObjectArmour } from '../../src/task/native-object-armour-set.mjs';

export const prepareTaskNative8AF1 = (options) =>
  prepareTaskPlan(options, [0x808af1], (a) => setObjectArmour(a));
