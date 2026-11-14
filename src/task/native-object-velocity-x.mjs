import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { objectVelocityX } from '../game/object-fields.mjs';

// 80:A941 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the X velocity of the object (first
// argument).
export const getObjectVelocityX = (a, outerReturn = true) => {
  setLeafResult(a, objectVelocityX(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
