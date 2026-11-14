// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
// The register-level reference; the game runs the lifted native.
import { placeObjectOnWaypointReference } from '../game-reference/motion-targets.mjs';

export const prepareTaskNativeD105 = (options) =>
  prepareTaskPlan(options, [0x80d105], (a) => placeObjectOnWaypointReference(a));
