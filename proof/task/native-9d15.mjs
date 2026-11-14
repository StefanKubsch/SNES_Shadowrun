// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setItemPropertyAndUnequip } from '../../src/task/native-object-record-property-equip.mjs';

export const prepareTaskNative9D15 = (options) =>
  prepareTaskPlan(options, [0x809d15], (a) => setItemPropertyAndUnequip(a));
