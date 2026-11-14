// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { hasFightTargetReference } from '../game-reference/fight-list-queries.mjs';

export const prepareTaskNative866F = (options) =>
  prepareTaskPlan(options, [0x80866f], (a) => hasFightTargetReference(a));
