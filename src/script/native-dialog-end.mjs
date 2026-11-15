import { finishLeaf } from '../system/native-leaf-support.mjs';
import { endDialog as end } from '../game/script-requests.mjs';

// 80:CDCF (lifted in src/game/script-requests.mjs; register-level reference in
// proof/game-reference/script-requests.mjs): end the running dialog or menu.
export const endDialog = (a, outerReturn = true) => {
  end(a.mem);
  return finishLeaf(a, outerReturn);
};
