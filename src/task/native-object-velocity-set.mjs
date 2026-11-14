import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_VELOCITY_X, OBJECT_VELOCITY_Y, OBJECT_VELOCITY_Z } from './wram.mjs';

const THIRD_ARGUMENT = 4,
  FOURTH_ARGUMENT = 6;

// 80:A92F: set the X, Y and Z velocity of the object (first argument) to the second,
// third and fourth argument.
export const setObjectVelocity = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      for (const [argument, velocity] of [
        [SECOND_ARGUMENT, OBJECT_VELOCITY_X],
        [THIRD_ARGUMENT, OBJECT_VELOCITY_Y],
        [FOURTH_ARGUMENT, OBJECT_VELOCITY_Z],
      ])
        h.longWrite(h.abs(velocity) + object, h.load(h.dp(argument)));
    },
    outerReturn,
  );
