import { finishLeaf } from './native-leaf-support.mjs';
import { requestMainLoopExit as requestExit } from '../game/script-requests.mjs';

// 80:D9A0 (lifted in src/game/script-requests.mjs; register-level reference in
// proof/game-reference/script-requests.mjs): ask the main loop to exit.
export const requestMainLoopExit = (a, outerReturn = true) => {
  requestExit(a.mem);
  return finishLeaf(a, outerReturn);
};
