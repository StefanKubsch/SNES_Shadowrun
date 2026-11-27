import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from '../system/native-leaf-support.mjs';
import { moveToWaypoint } from '../game/motion-targets.mjs';

const waypointNative = (straight) => (a) => {
  moveToWaypoint(
    a.mem,
    leafArgument(a, FIRST_ARGUMENT),
    leafArgument(a, SECOND_ARGUMENT),
    straight,
  );
  return finishLeaf(a);
};

// 80:C6C4 (lifted in src/game/motion-targets.mjs; register-level reference in
// proof/game-reference/motion-targets.mjs): move the object (first argument) axis by axis
// towards the waypoint in the second argument.
export const moveObjectToWaypoint = waypointNative(false);
// 80:C6BF (likewise): move the object (first argument) straight towards the waypoint in
// the second argument.
export const moveObjectStraightToWaypoint = waypointNative(true);
