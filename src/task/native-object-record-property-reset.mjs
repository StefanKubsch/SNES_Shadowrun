import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { resetRecordProperty } from '../game/object-fields.mjs';

// 80:9D7A (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): reset the property word of the record of the
// object (first argument); without a record nothing changes.
export const resetObjectRecordProperty = (a, outerReturn = true) => {
  resetRecordProperty(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
