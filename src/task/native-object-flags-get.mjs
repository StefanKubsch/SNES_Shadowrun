import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_FLAGS } from './wram.mjs';

// 80:CA05: return the flag word of the object (first argument).
export const getObjectFlags = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(h.abs(OBJECT_FLAGS) + object)));
    },
    outerReturn,
  );
