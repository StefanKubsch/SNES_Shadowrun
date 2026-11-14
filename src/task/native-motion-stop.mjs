import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { MOTION_ACTIVE, WRAM } from './wram.mjs';

const NO_MOTION = 0;

// 80:C7C2: clear the motion target of the object (first argument).
export const stopMotion = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.longWrite(WRAM + MOTION_ACTIVE + object, h.load(NO_MOTION));
    },
    outerReturn,
  );
