import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { OBJECT_Y } from './wram.mjs';

// 80:A963: return the Y position of the object (first argument) divided by four
// (two LSRs; the carry keeps the second shifted-out bit).
export const getObjectCoarseY = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(h.longRead(h.abs(OBJECT_Y) + object));
      h.lsr();
      h.result(h.lsr());
    },
    outerReturn,
  );
