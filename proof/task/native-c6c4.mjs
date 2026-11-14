// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { moveObjectToWaypoint } from '../../src/task/native-motion-waypoint-move.mjs';

export const prepareTaskNativeC6C4 = (options) =>
  prepareTaskPlan(options, [0x80c6c4], (a) => moveObjectToWaypoint(a));
