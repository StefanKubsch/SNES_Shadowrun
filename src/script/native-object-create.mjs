import { taskStop } from '../system/task-stop.mjs';
import { finishLeaf } from '../system/native-leaf-support.mjs';
import { createObject as createLiftedObject } from '../game/object-create.mjs';

// 80:A835 as the script native (lifted in src/game/object-create.mjs; register-level
// reference in proof/script/native-object-create.mjs).
export const createObjectNative = (a, outerReturn = true) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  createLiftedObject(a.mem, a.mem.wram, a);
  return finishLeaf(a, outerReturn);
};
