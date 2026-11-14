import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { previousFightObject } from '../game/fight-list.mjs';

// 80:8631 (lifted in src/game/fight-list.mjs; register-level reference in
// proof/game-reference/fight-list-queries.mjs): return the object before the object
// (first argument) in the fight list (FFFF: none).
export const getPreviousFightObject = (a, outerReturn = true) => {
  setLeafResult(a, previousFightObject(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
