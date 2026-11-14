// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { addMagicPointsReference } from '../game-reference/party-funds.mjs';

export const prepareTaskNative8B8A = (options) =>
  prepareTaskPlan(options, [0x808b8a], (a) => addMagicPointsReference(a));
