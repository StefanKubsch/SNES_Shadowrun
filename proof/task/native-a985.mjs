// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setObjectAnimationReference } from '../game-reference/object-turn.mjs';

export const prepareTaskNativeA985 = (options) =>
  prepareTaskPlan(options, [0x80a985], (a) => setObjectAnimationReference(a));
