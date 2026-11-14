// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { stopMotionReference } from '../game-reference/motion-targets.mjs';

export const prepareTaskNativeC7C2 = (options) =>
  prepareTaskPlan(options, [0x80c7c2], (a) => stopMotionReference(a));
