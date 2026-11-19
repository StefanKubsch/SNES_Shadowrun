// Script native 80:D15C, lifted (src/game/member-facing.mjs); the register-level
// reference is in proof/script/native-object-turn.mjs.
import { finishLeaf } from '../system/native-leaf-support.mjs';
import { setActionAndDirection } from '../game/member-facing.mjs';

// 80:D15C (lifted in src/game/member-facing.mjs; register-level reference in
// proof/script/native-object-turn.mjs): set the
// object's action selection (A985), then its direction (AAAF).
export const setObjectActionAndDirection = (a, outerReturn = true) => {
  setActionAndDirection(a.mem);
  return finishLeaf(a, outerReturn);
};
