// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getPreviousFightObjectReference } from '../game-reference/fight-list-queries.mjs';

export const prepareTaskNative8631 = (options) =>
  prepareTaskPlan(options, [0x808631], (a) => getPreviousFightObjectReference(a));
