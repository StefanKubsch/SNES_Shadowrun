import { finishLeaf } from '../system/native-leaf-support.mjs';
import { resetPlayerControl as reset } from '../game/script-requests.mjs';

// 80:DE7E (lifted in src/game/script-requests.mjs; register-level reference in
// proof/game-reference/script-requests.mjs): reset the player control state on a scene
// change.
export const resetPlayerControl = (a, outerReturn = true) => {
  reset(a.mem);
  return finishLeaf(a, outerReturn);
};
