import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from '../system/native-leaf-support.mjs';
import { placeOnWaypoint } from '../game/motion-targets.mjs';

// 80:D105 (lifted in src/game/motion-targets.mjs; register-level reference in
// proof/game-reference/motion-targets.mjs): place the object (first argument) on the
// waypoint (second argument) of the room's point list and stop its motion.
export const placeObjectOnWaypoint = (a, outerReturn = true) => {
  placeOnWaypoint(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
