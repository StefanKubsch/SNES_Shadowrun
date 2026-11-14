import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { objectCoarseHeight } from '../game/object-fields.mjs';

// 80:A96D (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the height of the object (first argument)
// divided by four.
export const getObjectCoarseHeight = (a, outerReturn = true) => {
  setLeafResult(a, objectCoarseHeight(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
