import { finishLeaf } from '../system/native-leaf-support.mjs';
import { moveSwarmAlongPath as move } from '../game/swarm-motion.mjs';

// 80:D85B (lifted in src/game/swarm-motion.mjs; register-level reference in
// proof/game-reference/swarm-motion.mjs; no argument): move the swarm along its path.
export const moveSwarmAlongPath = (a, outerReturn = true) => {
  move(a.mem);
  return finishLeaf(a, outerReturn);
};
