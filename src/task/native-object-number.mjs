import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_NUMBER } from './wram.mjs';

// 80:D1CA: return the object number of the object slot (first argument).
export const getObjectNumber = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(h.abs(OBJECT_NUMBER) + object)));
    },
    outerReturn,
  );
