import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { setSwarmHeightSpeedGoal } from '../game/swarm-setup.mjs';

// 80:D997 (lifted in src/game/swarm-setup.mjs; register-level reference in
// proof/game-reference/swarm-setup.mjs): set the target wave speed of the swarm
// height to the first argument as a wave index.
export const setSwarmHeightSpeedTarget = (a, outerReturn = true) => {
  setSwarmHeightSpeedGoal(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
