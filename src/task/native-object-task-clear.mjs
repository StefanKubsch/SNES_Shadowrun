import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { clearObjectTask as clearTask } from '../game/object-fields.mjs';

// 80:A91D (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): detach the object (first argument) from its task.
export const clearObjectTask = (a, outerReturn = true) => {
  clearTask(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
