import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_DEPTH_ORDER, OBJECT_DEPTH_MODE_CLEAR_MASK } from './wram.mjs';

// 80:D16D: replace the sprite mode bits of the object (first argument) with the
// second argument; the other depth order bits stay. The argument is not masked.
export const setSpriteMode = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        address = h.abs(OBJECT_DEPTH_ORDER) + object,
        order = h.load(h.longRead(address)),
        kept = h.load(order & OBJECT_DEPTH_MODE_CLEAR_MASK);
      h.longWrite(address, h.load(kept | h.dp(SECOND_ARGUMENT)));
    },
    outerReturn,
  );
