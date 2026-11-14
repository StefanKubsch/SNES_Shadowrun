// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getScriptVariableReference } from '../game-reference/script-variables.mjs';

export const prepareTaskNativeCC07 = (options) =>
  prepareTaskPlan(options, [0x80cc07], (a) => getScriptVariableReference(a));
