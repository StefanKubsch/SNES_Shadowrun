import { finishLeaf, setLeafResult } from './native-leaf-support.mjs';
import { playerObject } from '../game/script-queries.mjs';

// 80:D18A (lifted in src/game/script-queries.mjs; register-level reference in
// proof/game-reference/script-queries.mjs): a second, byte-identical ROM copy of
// getPlayerObject (80:CD97) with its own native ID.
export const getPlayerObjectCopy = (a, outerReturn = true) => {
  setLeafResult(a, playerObject(a.mem));
  return finishLeaf(a, outerReturn);
};
