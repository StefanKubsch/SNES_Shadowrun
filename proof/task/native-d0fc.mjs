// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { getActorKindReference } from '../game-reference/kind-values.mjs';

export const prepareTaskNativeD0FC = (options) =>
  prepareTaskPlan(options, [0x80d0fc], (a) => getActorKindReference(a));
