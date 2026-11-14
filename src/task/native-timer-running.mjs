import { finishLeaf, setLeafResult } from './native-leaf-support.mjs';
import { timeLimitRunning } from '../game/time-limit.mjs';

// 80:E262 (lifted in src/game/time-limit.mjs; register-level reference in
// proof/game-reference/script-timer.mjs): return TRUE (FFFF) while the countdown or its
// frame counter is nonzero, else 0.
export const isTimerRunning = (a, outerReturn = true) => {
  setLeafResult(a, timeLimitRunning(a.mem));
  return finishLeaf(a, outerReturn);
};
