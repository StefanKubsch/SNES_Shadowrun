import {
  FIRST_ARGUMENT,
  finishLeaf,
  leafArgument,
  setLeafResult,
} from '../system/native-leaf-support.mjs';
import { hasRecordProperty } from '../game/object-fields.mjs';

// 80:9D98 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): return TRUE (FFFF) when the object (first
// argument) has a record whose property word is not negative, else FALSE (0).
export const hasObjectRecordProperty = (a, outerReturn = true) => {
  setLeafResult(a, hasRecordProperty(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a, outerReturn);
};
