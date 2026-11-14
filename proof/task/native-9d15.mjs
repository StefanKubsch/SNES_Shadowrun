// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setItemPropertyAndUnequipReference } from '../game-reference/runner-equipment.mjs';

export const prepareTaskNative9D15 = (options) =>
  prepareTaskPlan(options, [0x809d15], (a) => setItemPropertyAndUnequipReference(a));
