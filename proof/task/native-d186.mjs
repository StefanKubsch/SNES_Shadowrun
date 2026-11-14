// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getPlayerObjectAfterBreakReference } from '../game-reference/script-starts.mjs';

export const prepareTaskNativeD186 = (options) =>
  prepareTaskPlan(options, [0x80d186], (a) => getPlayerObjectAfterBreakReference(a));
