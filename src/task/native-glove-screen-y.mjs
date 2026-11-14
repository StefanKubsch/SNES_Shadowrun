import { finishLeaf, setLeafResult } from './native-leaf-support.mjs';
import { gloveScreenY } from '../game/script-queries.mjs';

// 80:C100 (lifted in src/game/script-queries.mjs; register-level reference in
// proof/game-reference/script-queries.mjs): return the screen Y position (one byte) of the
// glove sprite.
export const getGloveScreenY = (a, outerReturn = true) => {
  setLeafResult(a, gloveScreenY(a.mem));
  return finishLeaf(a, outerReturn);
};
