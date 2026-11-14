// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { isInFightListReference } from '../game-reference/fight-list-queries.mjs';

export const prepareTaskNative8656 = (options) =>
  prepareTaskPlan(options, [0x808656], (a) => isInFightListReference(a));
