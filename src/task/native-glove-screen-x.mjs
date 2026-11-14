import { finishLeaf, setLeafResult } from './native-leaf-support.mjs';
import { gloveScreenX } from '../game/script-queries.mjs';

// 80:C0F7 (lifted in src/game/script-queries.mjs; register-level reference in
// proof/game-reference/script-queries.mjs): return the screen X position (one byte) of the
// glove sprite.
export const getGloveScreenX = (a, outerReturn = true) => {
  setLeafResult(a, gloveScreenX(a.mem));
  return finishLeaf(a, outerReturn);
};
