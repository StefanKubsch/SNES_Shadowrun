import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_VELOCITY_X } from './wram.mjs';

// 80:A941: return the X velocity of the object (first argument).
export const getObjectVelocityX = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(h.abs(OBJECT_VELOCITY_X) + object)));
    },
    outerReturn,
  );
