// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { appendSelectedSpellTaskReference } from '../game-reference/script-starts.mjs';

export const prepareTaskNative8EDA = (options) =>
  prepareTaskPlan(options, [0x808eda], (a) => appendSelectedSpellTaskReference(a));
