import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_ARMOUR, WRAM } from './wram.mjs';

// 80:8B08: armour of the object (first argument) minus the second argument,
// as a wrapping 16-bit difference without a lower limit. X keeps the object index.
export const subtractObjectArmour = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        armour = h.subtract(h.longRead(WRAM + OBJECT_ARMOUR + object), h.dp(SECOND_ARGUMENT));
      h.longWrite(WRAM + OBJECT_ARMOUR + object, armour);
    },
    outerReturn,
  );
