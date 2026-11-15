import { taskStop } from '../system/task-stop.mjs';
import { finishLeaf } from '../system/native-leaf-support.mjs';
import {
  circleSwarmLeader as circle,
  startPathSwarm as startPath,
  startWaveSwarm as startWave,
} from '../game/swarm-start.mjs';

// The swarm start natives (lifted in src/game/swarm-start.mjs; register-level references
// in proof/game-reference/swarm-start.mjs).
const lifted =
  (run) =>
  (a, outerReturn = true) => {
    if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
    run(a.mem, a);
    return finishLeaf(a, outerReturn);
  };
// 80:D7DD: start the path swarm around the object (first argument).
export const startPathSwarm = lifted(startPath);
// 80:D260: start the wave swarm around the object (first argument).
export const startWaveSwarm = lifted(startWave);
// 80:D63C: move the circling leader and add its followers.
export const circleSwarmLeader = lifted(circle);
