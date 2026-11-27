import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from '../system/native-leaf-support.mjs';
import { moveSwarmWave as move } from '../game/swarm-motion.mjs';

// 80:D2E7 (lifted in src/game/swarm-motion.mjs; register-level reference in
// proof/game-reference/swarm-motion.mjs): move the swarm as a wave, or with a first
// argument of 1 set the wave's target to the point (second argument) of the room's list.
export const moveSwarmWave = (a) => {
  move(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a);
};
