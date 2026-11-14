// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { startBrightnessFadeReference } from '../game-reference/brightness-fade.mjs';

export const prepareTaskNativeD9AD = (options) =>
  prepareTaskPlan(options, [0x80d9ad], (a) => startBrightnessFadeReference(a));
