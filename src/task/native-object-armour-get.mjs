import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_ARMOUR, WRAM } from './wram.mjs';

// 80:8EF5: return the armour of the object (first argument).
export const getObjectArmour = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(WRAM + OBJECT_ARMOUR + object)));
    },
    outerReturn,
  );
