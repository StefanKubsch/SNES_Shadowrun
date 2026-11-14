import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_VELOCITY_Y } from './wram.mjs';

// 80:A949: return the Y velocity of the object (first argument).
export const getObjectVelocityY = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(h.abs(OBJECT_VELOCITY_Y) + object)));
    },
    outerReturn,
  );
