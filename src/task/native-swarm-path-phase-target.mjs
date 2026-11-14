import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { setSwarmPathPhaseGoal } from '../game/swarm-setup.mjs';

// 80:D985 (lifted in src/game/swarm-setup.mjs; register-level reference in
// proof/game-reference/swarm-setup.mjs): set the target wave phase of the swarm
// path (X/Y) to the first argument as a wave index.
export const setSwarmPathPhaseTarget = (a, outerReturn = true) => {
  setSwarmPathPhaseGoal(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
