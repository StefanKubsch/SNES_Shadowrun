// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { setActorItemPropertyAndUnequipReference } from '../game-reference/runner-equipment.mjs';

export const prepareTaskNative9CE4 = (options) =>
  prepareTaskPlan(options, [0x809ce4], (a) => setActorItemPropertyAndUnequipReference(a));
