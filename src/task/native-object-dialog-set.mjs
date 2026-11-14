import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_DIALOG, WRAM } from './wram.mjs';

// 80:94EE: set the dialog record of the object (first argument) to the second argument.
export const setObjectDialog = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        dialog = h.load(h.dp(SECOND_ARGUMENT));
      h.longWrite(WRAM + OBJECT_DIALOG + object, dialog);
    },
    outerReturn,
  );
