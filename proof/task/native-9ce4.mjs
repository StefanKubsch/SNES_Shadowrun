// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { setActorItemPropertyAndUnequip } from '../../src/task/native-record-property-equip.mjs';

export const prepareTaskNative9CE4 = (options) =>
  prepareTaskPlan(options, [0x809ce4], (a) => setActorItemPropertyAndUnequip(a));
