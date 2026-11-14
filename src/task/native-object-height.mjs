import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_HEIGHT } from './wram.mjs';

// 80:A96D: return the height of the object (first argument) divided by four
// (two LSRs; the carry keeps the second shifted-out bit).
export const getObjectCoarseHeight = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(h.longRead(h.abs(OBJECT_HEIGHT) + object));
      h.lsr();
      h.result(h.lsr());
    },
    outerReturn,
  );
