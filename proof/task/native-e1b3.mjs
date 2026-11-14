// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { learnSpellReference } from '../game-reference/party-funds.mjs';

export const prepareTaskNativeE1B3 = (options) =>
  prepareTaskPlan(options, [0x80e1b3], (a) => learnSpellReference(a));
