import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { bindObjectToCurrentTask as bindTask } from '../game/object-fields.mjs';

// 80:A926 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): bind the object (first argument) to the
// currently running task.
export const bindObjectToCurrentTask = (a, outerReturn = true) => {
  bindTask(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a, outerReturn);
};
