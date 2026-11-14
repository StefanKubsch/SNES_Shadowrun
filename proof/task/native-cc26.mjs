// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { keepScriptVariableBitsReference } from '../game-reference/script-variables.mjs';

export const prepareTaskNativeCC26 = (options) =>
  prepareTaskPlan(options, [0x80cc26], (a) => keepScriptVariableBitsReference(a));
