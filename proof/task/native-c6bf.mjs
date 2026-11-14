// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { moveObjectStraightToWaypoint } from '../../src/task/native-motion-waypoint-follow.mjs';

export const prepareTaskNativeC6BF = (options) =>
  prepareTaskPlan(options, [0x80c6bf], (a) => moveObjectStraightToWaypoint(a));
