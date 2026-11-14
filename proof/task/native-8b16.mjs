// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { equipRunnerArmour } from '../../src/task/native-runner-armour-equip.mjs';

export const prepareTaskNative8B16 = (options) =>
  prepareTaskPlan(options, [0x808b16], (a) => equipRunnerArmour(a));
