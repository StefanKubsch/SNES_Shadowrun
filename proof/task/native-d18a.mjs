// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getPlayerObjectCopyReference } from '../game-reference/script-queries.mjs';

export const prepareTaskNativeD18A = (options) =>
  prepareTaskPlan(options, [0x80d18a], (a) => getPlayerObjectCopyReference(a));
