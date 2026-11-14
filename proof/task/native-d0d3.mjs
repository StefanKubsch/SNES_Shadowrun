// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { updateObjectDepthModeReference } from '../game-reference/object-fields.mjs';

export const prepareTaskNativeD0D3 = (options) =>
  prepareTaskPlan(options, [0x80d0d3], (a) => updateObjectDepthModeReference(a));
