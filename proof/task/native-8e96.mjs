// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { haltObjectReference } from '../game-reference/object-halt.mjs';

export const prepareTaskNative8E96 = (options) =>
  prepareTaskPlan(options, [0x808e96], (a) => haltObjectReference(a));
