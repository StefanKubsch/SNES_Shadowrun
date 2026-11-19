import { finishLeaf } from '../system/native-leaf-support.mjs';
import { runnerStrength } from '../game/runner-state.mjs';

// 80:D067 (lifted in src/game/runner-state.mjs; register-level reference in
// proof/game-reference/script-starts.mjs): return the Strength of the runner object
// (first argument).
export const getRunnerStrength = (a, outerReturn = true) => {
  runnerStrength(a.mem, a);
  return finishLeaf(a, outerReturn);
};
