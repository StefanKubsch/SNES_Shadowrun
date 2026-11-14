import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_FLAGS } from './wram.mjs';

// 80:CA0D: replace the flag word of the object (first argument) with the second argument.
export const setObjectFlags = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        flags = h.load(h.dp(SECOND_ARGUMENT));
      h.longWrite(h.abs(OBJECT_FLAGS) + object, flags);
    },
    outerReturn,
  );
