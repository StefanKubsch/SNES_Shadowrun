// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { equipRunnerArmourReference } from '../game-reference/runner-equipment.mjs';

export const prepareTaskNative8B16 = (options) =>
  prepareTaskPlan(options, [0x808b16], (a) => equipRunnerArmourReference(a));
