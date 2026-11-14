import { finishLeaf, setLeafResult } from './native-leaf-support.mjs';
import { padHeld } from '../game/script-queries.mjs';

// 80:9E59 (lifted in src/game/script-queries.mjs; register-level reference in
// proof/game-reference/script-queries.mjs): return the joypad buttons currently held.
export const getPadHeld = (a, outerReturn = true) => {
  setLeafResult(a, padHeld(a.mem));
  return finishLeaf(a, outerReturn);
};
