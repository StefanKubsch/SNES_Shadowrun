import { FIRST_ARGUMENT, finishLeaf, leafArgument } from '../system/native-leaf-support.mjs';
import { bindObjectToCurrentTask as bindTask } from '../game/object-fields.mjs';
import { tasksOf } from './task-api.mjs';

// 80:A926 (lifted in src/game/object-fields.mjs; register-level reference in
// proof/game-reference/object-fields.mjs): bind the object (first argument) to the
// currently running task.
export const bindObjectToCurrentTask = (a) => {
  bindTask(a.mem, leafArgument(a, FIRST_ARGUMENT), tasksOf(a));
  return finishLeaf(a);
};
