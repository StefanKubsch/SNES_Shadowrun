import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { NO_TASK, OBJECT_TASK } from './wram.mjs';

// 80:A91D: detach the object (first argument) from its task.
export const clearObjectTask = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.longWrite(h.abs(OBJECT_TASK) + object, h.load(NO_TASK));
    },
    outerReturn,
  );
