import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_TASK } from './wram.mjs';
import { TASK_CURSOR } from '../vm/layout.mjs';

// 80:A926: bind the object (first argument) to the currently running task.
export const bindObjectToCurrentTask = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        task = h.load(h.longRead(h.abs(TASK_CURSOR)));
      h.longWrite(h.abs(OBJECT_TASK) + object, task);
    },
    outerReturn,
  );
