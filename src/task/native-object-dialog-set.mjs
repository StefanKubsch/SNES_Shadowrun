import {
  FIRST_ARGUMENT,
  SECOND_ARGUMENT,
  finishLeaf,
  leafArgument,
} from './native-leaf-support.mjs';
import { setObjectDialog as setDialog } from '../game/object-fields.mjs';

// 80:94EE (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): set the dialog record of the object (first
// argument) to the second argument.
export const setObjectDialog = (a, outerReturn = true) => {
  setDialog(a.mem, leafArgument(a, FIRST_ARGUMENT), leafArgument(a, SECOND_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
