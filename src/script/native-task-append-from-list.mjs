import { taskStop } from '../system/task-stop.mjs';
import { finishLeaf } from '../system/native-leaf-support.mjs';
import { startSelectedSpell } from '../game/spell-start.mjs';

// 80:8EDA (lifted in src/game/spell-start.mjs; register-level reference in
// proof/game-reference/script-starts.mjs): start the selected spell's script with its
// level as the first argument.
export const appendSelectedSpellTask = (a, outerReturn = true) => {
  if (a.ctx.d !== 0) taskStop('task_direct_page_zero_required');
  startSelectedSpell(a.mem, a);
  return finishLeaf(a, outerReturn);
};
