// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { resetPlayerControlReference } from '../game-reference/script-requests.mjs';

export const prepareTaskNativeDE7E = (options) =>
  prepareTaskPlan(options, [0x80de7e], (a) => resetPlayerControlReference(a));
