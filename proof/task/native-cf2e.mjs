// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { raiseMemberMagicPointsReference } from '../game-reference/runner-state.mjs';

export const prepareTaskNativeCF2E = (options) =>
  prepareTaskPlan(options, [0x80cf2e], (a) => raiseMemberMagicPointsReference(a));
