import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { isInFightList as inList } from '../game/fight-list.mjs';

// 80:8656 (lifted in src/game/fight-list.mjs; register-level reference in
// proof/game-reference/fight-list-queries.mjs): return TRUE (FFFF) when the object (first
// argument) is in the fight list, else FALSE (0).
export const isInFightList = (a, outerReturn = true) => {
  setLeafResult(a, inList(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
