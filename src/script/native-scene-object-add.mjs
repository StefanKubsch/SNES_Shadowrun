import { taskStop } from '../system/task-stop.mjs';
import { finishLeaf } from '../system/native-leaf-support.mjs';
import { addSceneObject as addLiftedSceneObject } from '../game/scene-object-add.mjs';

// 80:A1E6 (lifted in src/game/scene-object-add.mjs; register-level reference in
// proof/game-reference/scene-object-add.mjs): add a group member's object to the scene.
// Arguments: the object kind, the direction (word 08), the actor entry (word 0A) and the
// position (word 0C).
export const addSceneObject = (a, outerReturn = true) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  addLiftedSceneObject(a.mem, a);
  return finishLeaf(a, outerReturn);
};
