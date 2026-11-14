import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { objectVelocityY } from '../game/object-fields.mjs';

// 80:A949 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the Y velocity of the object (first
// argument).
export const getObjectVelocityY = (a, outerReturn = true) => {
  setLeafResult(a, objectVelocityY(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
