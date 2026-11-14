import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_FLAGS } from './wram.mjs';

// 80:CA20: keep only the bits of the second argument in the flag word of the object (first argument).
export const keepObjectFlagBits = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        bits = h.load(h.dp(SECOND_ARGUMENT)),
        address = h.abs(OBJECT_FLAGS) + object;
      h.longWrite(address, h.load(bits & h.longRead(address)));
    },
    outerReturn,
  );
