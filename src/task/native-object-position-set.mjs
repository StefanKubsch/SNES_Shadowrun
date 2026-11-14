import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import {
  OBJECT_X,
  OBJECT_Y,
  OBJECT_HEIGHT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  DP_OBJECT_HEIGHT,
} from './wram.mjs';

// 80:D14A: set the X, Y and height of the object (first argument) to the second,
// third and fourth argument.
export const setObjectPosition = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      for (const [argument, field] of [
        [DP_OBJECT_X, OBJECT_X],
        [DP_OBJECT_Y, OBJECT_Y],
        [DP_OBJECT_HEIGHT, OBJECT_HEIGHT],
      ])
        h.longWrite(h.abs(field) + object, h.load(h.dp(argument)));
    },
    outerReturn,
  );
