import { finishLeaf, setLeafResult } from './native-leaf-support.mjs';
import { playerObject } from '../game/script-queries.mjs';

// 80:CD97 (lifted in src/game/script-queries.mjs; register-level reference in
// proof/game-reference/script-queries.mjs): return the object slot of the player figure (the
// leader).
export const getPlayerObject = (a, outerReturn = true) => {
  setLeafResult(a, playerObject(a.mem));
  return finishLeaf(a, outerReturn);
};
