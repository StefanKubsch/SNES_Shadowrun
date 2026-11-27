import { FIRST_ARGUMENT, finishLeaf, leafArgument } from '../system/native-leaf-support.mjs';
import { startSwarmOrbit as start } from '../game/swarm-setup.mjs';

// The orbit constants, defined with the lifted natives.
export {
  FIRST_FOLLOWER_FRAMES,
  ORBIT_START_PHASE,
  ORBIT_PHASES_END,
} from '../game/swarm-setup.mjs';
// 80:D604 (lifted in src/game/swarm-setup.mjs; register-level reference in
// proof/game-reference/swarm-setup.mjs): start the swarm orbit around the leader object
// (first argument).
export const startSwarmOrbit = (a) => {
  start(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a);
};
