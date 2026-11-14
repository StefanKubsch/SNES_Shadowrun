// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { addSceneObjectReference } from '../game-reference/scene-object-add.mjs';

export const prepareTaskNativeA1E6 = (options) =>
  prepareTaskPlan(options, [0x80a1e6], (a) => addSceneObjectReference(a));
