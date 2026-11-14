// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { equipRunnerWeaponReference } from '../game-reference/runner-equipment.mjs';

export const prepareTaskNative8B9F = (options) =>
  prepareTaskPlan(options, [0x808b9f], (a) => equipRunnerWeaponReference(a));
