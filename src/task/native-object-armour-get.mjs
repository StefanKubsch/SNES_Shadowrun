import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { objectArmour } from '../game/object-fields.mjs';

// 80:8EF5 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return the armour of the object (first argument).
export const getObjectArmour = (a, outerReturn = true) => {
  setLeafResult(a, objectArmour(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
