// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getObjectArmourReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNative8EF5 = (options) =>
  prepareTaskPlan(options, [0x808ef5], (a) => getObjectArmourReference(a));
