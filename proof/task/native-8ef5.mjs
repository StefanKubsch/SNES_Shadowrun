// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { getObjectArmour } from '../../src/task/native-object-armour-get.mjs';

export const prepareTaskNative8EF5 = (options) =>
  prepareTaskPlan(options, [0x808ef5], (a) => getObjectArmour(a));
