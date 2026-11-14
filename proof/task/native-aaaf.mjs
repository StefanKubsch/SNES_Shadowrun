// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setObjectDirectionReference } from '../game-reference/object-turn.mjs';

export const prepareTaskNativeAAAF = (options) =>
  prepareTaskPlan(options, [0x80aaaf], (a) => setObjectDirectionReference(a));
