import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { setSwarmPathSpeedGoal } from '../game/swarm-setup.mjs';

// 80:D98E (lifted in src/game/swarm-setup.mjs; register-level reference in
// proof/game-reference/swarm-setup.mjs): set the target wave speed of the swarm
// path (X/Y) to the first argument as a wave index.
export const setSwarmPathSpeedTarget = (a, outerReturn = true) => {
  setSwarmPathSpeedGoal(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
