import { finishLeaf } from './native-leaf-support.mjs';
import { requestRoomReload as requestReload } from '../game/script-requests.mjs';

// 80:D016 (lifted in src/game/script-requests.mjs; register-level reference in
// proof/game-reference/script-requests.mjs): ask the main loop to reload the current room.
export const requestRoomReload = (a, outerReturn = true) => {
  requestReload(a.mem);
  return finishLeaf(a, outerReturn);
};
