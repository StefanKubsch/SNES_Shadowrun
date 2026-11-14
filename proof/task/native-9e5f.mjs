// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getPadPressedReference } from '../game-reference/script-queries.mjs';

export const prepareTaskNative9E5F = (options) =>
  prepareTaskPlan(options, [0x809e5f], (a) => getPadPressedReference(a));
