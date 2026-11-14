// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { changeRoomReference } from '../game-reference/script-requests.mjs';

export const prepareTaskNativeCC97 = (options) =>
  prepareTaskPlan(options, [0x80cc97], (a) => changeRoomReference(a));
