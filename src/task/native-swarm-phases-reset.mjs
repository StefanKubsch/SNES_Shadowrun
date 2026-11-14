import { finishLeaf } from './native-leaf-support.mjs';
import { resetSwarmOrbit } from '../game/swarm-setup.mjs';

// 80:D622 (lifted in src/game/swarm-setup.mjs; register-level reference in
// proof/game-reference/swarm-setup.mjs): reset the swarm orbit: no circle follower yet,
// the countdown to the first follower, and every one of the sixteen member phases at the
// start phase.
export const resetSwarmPhases = (a, outerReturn = true) => {
  resetSwarmOrbit(a.mem);
  return finishLeaf(a, outerReturn);
};
