import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_ARMOUR, WRAM } from './wram.mjs';

// 80:8AF1: set the armour of the object (first argument) to the second argument.
export const setObjectArmour = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        armour = h.load(h.dp(SECOND_ARGUMENT));
      h.longWrite(WRAM + OBJECT_ARMOUR + object, armour);
    },
    outerReturn,
  );
