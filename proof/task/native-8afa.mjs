// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { addObjectArmourReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNative8AFA = (options) =>
  prepareTaskPlan(options, [0x808afa], (a) => addObjectArmourReference(a));
