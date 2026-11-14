import { leaf } from './native-leaf-support.mjs';
import { runTaskAction, taskSelectionSupport } from './native-object-turn.mjs';

// 80:AAAF: turn the object (first argument) to the direction in the second argument
// and move its frame to that direction, or restart its last animation when the frame
// count does not allow a direct switch (shared body in native-object-turn.mjs). Every
// call keeps its own fresh reads.
export const setObjectDirection = (a, outerReturn = true) =>
  leaf(a, (h) => runTaskAction(h, taskSelectionSupport(h)), outerReturn);
