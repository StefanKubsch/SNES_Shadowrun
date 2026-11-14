// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setObjectActionAndDirectionReference } from '../game-reference/object-turn.mjs';

export const prepareTaskNativeD15C = (options) =>
  prepareTaskPlan(options, [0x80d15c], (a) => setObjectActionAndDirectionReference(a));
