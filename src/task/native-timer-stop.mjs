import { finishLeaf } from './native-leaf-support.mjs';
import { stopTimeLimit } from '../game/time-limit.mjs';

// 80:E24E (lifted in src/game/time-limit.mjs; register-level reference in
// proof/game-reference/script-timer.mjs): stop the countdown timer.
export const stopTimer = (a, outerReturn = true) => {
  stopTimeLimit(a.mem);
  return finishLeaf(a, outerReturn);
};
