// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { addObjectArmour } from '../../src/task/native-object-armour-add.mjs';

export const prepareTaskNative8AFA = (options) =>
  prepareTaskPlan(options, [0x808afa], (a) => addObjectArmour(a));
