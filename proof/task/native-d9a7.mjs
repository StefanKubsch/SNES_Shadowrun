// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { halveArgumentSignedReference } from '../game-reference/script-measures.mjs';

export const prepareTaskNativeD9A7 = (options) =>
  prepareTaskPlan(options, [0x80d9a7], (a) => halveArgumentSignedReference(a));
