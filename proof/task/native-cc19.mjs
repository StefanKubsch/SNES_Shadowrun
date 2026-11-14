// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setScriptVariableBitsReference } from '../game-reference/script-variables.mjs';

export const prepareTaskNativeCC19 = (options) =>
  prepareTaskPlan(options, [0x80cc19], (a) => setScriptVariableBitsReference(a));
