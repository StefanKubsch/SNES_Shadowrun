// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { addNuyenReference } from '../game-reference/party-funds.mjs';

export const prepareTaskNativeCCDB = (options) =>
  prepareTaskPlan(options, [0x80ccdb], (a) => addNuyenReference(a));
