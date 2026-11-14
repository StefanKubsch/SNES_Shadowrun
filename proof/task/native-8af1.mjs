// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setObjectArmourReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNative8AF1 = (options) =>
  prepareTaskPlan(options, [0x808af1], (a) => setObjectArmourReference(a));
