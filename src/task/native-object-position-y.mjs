import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { objectCoarseY } from '../game/object-fields.mjs';

// 80:A963 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the Y position of the object (first
// argument) divided by four.
export const getObjectCoarseY = (a, outerReturn = true) => {
  setLeafResult(a, objectCoarseY(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
