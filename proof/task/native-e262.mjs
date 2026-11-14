// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { isTimerRunningReference } from '../game-reference/script-timer.mjs';

export const prepareTaskNativeE262 = (options) =>
  prepareTaskPlan(options, [0x80e262], (a) => isTimerRunningReference(a));
