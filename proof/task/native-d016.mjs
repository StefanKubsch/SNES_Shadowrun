// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { requestRoomReloadReference } from '../game-reference/script-requests.mjs';

export const prepareTaskNativeD016 = (options) =>
  prepareTaskPlan(options, [0x80d016], (a) => requestRoomReloadReference(a));
