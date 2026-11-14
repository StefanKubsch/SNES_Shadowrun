// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { subtractObjectArmour } from '../../src/task/native-object-armour-subtract.mjs';

export const prepareTaskNative8B08 = (options) =>
  prepareTaskPlan(options, [0x808b08], (a) => subtractObjectArmour(a));
