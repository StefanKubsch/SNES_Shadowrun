// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { placeObjectOnWaypoint } from '../../src/task/native-object-to-waypoint.mjs';

export const prepareTaskNativeD105 = (options) =>
  prepareTaskPlan(options, [0x80d105], (a) => placeObjectOnWaypoint(a));
