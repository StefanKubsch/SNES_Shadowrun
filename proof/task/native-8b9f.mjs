// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { equipRunnerWeapon } from '../../src/task/native-runner-weapon-equip.mjs';

export const prepareTaskNative8B9F = (options) =>
  prepareTaskPlan(options, [0x808b9f], (a) => equipRunnerWeapon(a));
