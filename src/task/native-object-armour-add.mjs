import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_ARMOUR, WRAM } from './wram.mjs';

// 80:8AFA: armour of the object (first argument) plus the second argument,
// as a wrapping 16-bit sum without a limit. X keeps the object index.
export const addObjectArmour = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        armour = h.add(h.longRead(WRAM + OBJECT_ARMOUR + object), h.dp(SECOND_ARGUMENT));
      h.longWrite(WRAM + OBJECT_ARMOUR + object, armour);
    },
    outerReturn,
  );
