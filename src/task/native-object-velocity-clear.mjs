import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_VELOCITY_X, OBJECT_VELOCITY_Y, OBJECT_VELOCITY_Z } from './wram.mjs';

// 80:D13E: set the X, Y and Z velocity of the object (first argument) to zero.
export const clearObjectVelocity = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      for (const velocity of [OBJECT_VELOCITY_X, OBJECT_VELOCITY_Y, OBJECT_VELOCITY_Z])
        h.longWrite(h.abs(velocity) + object, 0);
    },
    outerReturn,
  );
