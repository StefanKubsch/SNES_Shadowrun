import {
  FIRST_ARGUMENT,
  finishLeaf,
  leafArgument,
  setLeafResult,
} from '../system/native-leaf-support.mjs';
import { objectVelocityZ } from '../game/object-fields.mjs';

// 80:A951 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the Z (height) velocity of the object
// (first argument).
export const getObjectVelocityZ = (a) => {
  setLeafResult(a, objectVelocityZ(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a);
};
