// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { changeSceneReference } from '../game-reference/script-requests.mjs';

export const prepareTaskNativeCC33 = (options) =>
  prepareTaskPlan(options, [0x80cc33], (a) => changeSceneReference(a));
