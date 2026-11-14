// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setScriptVariableReference } from '../game-reference/script-variables.mjs';

export const prepareTaskNativeCC10 = (options) =>
  prepareTaskPlan(options, [0x80cc10], (a) => setScriptVariableReference(a));
