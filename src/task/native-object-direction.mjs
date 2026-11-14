import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { objectDirection } from '../game/object-fields.mjs';

// 80:D255 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the facing direction (low byte) of the
// object (first argument).
export const getObjectDirection = (a, outerReturn = true) => {
  setLeafResult(a, objectDirection(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
