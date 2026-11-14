import { FIRST_ARGUMENT, leaf, returnKindValue } from './native-leaf-support.mjs';
import { OBJECT_KIND, WRAM } from './wram.mjs';

// 80:C9F1: return the kind value of the object (first argument).
export const getObjectKindValue = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(h.longRead(WRAM + OBJECT_KIND + object));
      returnKindValue(h, 'leaf-intermediate-DP00', 'leaf-result-DP00');
    },
    outerReturn,
  );
