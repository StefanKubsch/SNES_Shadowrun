import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_DEPTH_ORDER, OBJECT_DEPTH_MODE_MASK } from './wram.mjs';

// 80:D17B: return the sprite mode bits of the depth order word of the object (first argument).
export const getSpriteMode = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        order = h.load(h.longRead(h.abs(OBJECT_DEPTH_ORDER) + object));
      h.result(h.load(order & OBJECT_DEPTH_MODE_MASK));
    },
    outerReturn,
  );
