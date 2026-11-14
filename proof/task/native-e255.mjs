// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { startTimerReference } from '../game-reference/script-timer.mjs';

export const prepareTaskNativeE255 = (options) =>
  prepareTaskPlan(options, [0x80e255], (a) => startTimerReference(a));
