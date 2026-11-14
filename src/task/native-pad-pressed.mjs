import { finishLeaf, setLeafResult } from './native-leaf-support.mjs';
import { padPressed } from '../game/script-queries.mjs';

// 80:9E5F (lifted in src/game/script-queries.mjs; register-level reference in
// proof/game-reference/script-queries.mjs): return the joypad buttons newly pressed this
// frame.
export const getPadPressed = (a, outerReturn = true) => {
  setLeafResult(a, padPressed(a.mem));
  return finishLeaf(a, outerReturn);
};
