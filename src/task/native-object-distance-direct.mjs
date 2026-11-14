import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
  setLeafResult,
} from './native-leaf-support.mjs';
import { objectDistance } from '../game/object-distance.mjs';

// 80:C694 (lifted in src/game/object-distance.mjs; register-level reference in
// proof/game-reference/script-measures.mjs): distance between the objects in the first
// and second argument: the larger of |dx| and |dy|, divided by four.
export const getDistanceBetweenObjects = (a, outerReturn = true) => {
  setLeafResult(
    a,
    objectDistance(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT)),
  );
  return finishLeaf(a, outerReturn);
};
