import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { setSwarmHeightPhaseGoal } from '../game/swarm-setup.mjs';

// 80:D97C (lifted in src/game/swarm-setup.mjs; register-level reference in
// proof/game-reference/swarm-setup.mjs): set the target wave phase of the swarm
// height to the first argument as a wave index.
export const setSwarmHeightPhaseTarget = (a, outerReturn = true) => {
  setSwarmHeightPhaseGoal(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
