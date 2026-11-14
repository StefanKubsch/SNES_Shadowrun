// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { addKarmaReference } from '../game-reference/party-funds.mjs';

export const prepareTaskNativeCDB2 = (options) =>
  prepareTaskPlan(options, [0x80cdb2], (a) => addKarmaReference(a));
