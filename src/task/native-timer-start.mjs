import { finishLeaf } from './native-leaf-support.mjs';
import { startTimeLimit } from '../game/time-limit.mjs';

// 80:E255 (lifted in src/game/time-limit.mjs; register-level reference in
// proof/game-reference/script-timer.mjs): start the countdown timer.
export const startTimer = (a, outerReturn = true) => {
  startTimeLimit(a.mem);
  return finishLeaf(a, outerReturn);
};
