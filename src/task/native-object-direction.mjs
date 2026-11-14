import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_DIRECTION } from './wram.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 80:D255: return the facing direction (low byte) of the object (first argument).
export const getObjectDirection = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        word = h.load(h.longRead(h.abs(OBJECT_DIRECTION) + object));
      h.result(h.load(word & BYTE_MASK));
    },
    outerReturn,
  );
