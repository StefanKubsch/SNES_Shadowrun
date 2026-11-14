import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { setRecordPropertyFromGroup } from '../game/object-fields.mjs';

// 80:9D6A (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): set the property word of the record of the
// object (first argument) to the first word of the group numbers; an object without a
// record is unchanged.
export const setObjectRecordPropertyFromGroup = (a, outerReturn = true) => {
  setRecordPropertyFromGroup(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
