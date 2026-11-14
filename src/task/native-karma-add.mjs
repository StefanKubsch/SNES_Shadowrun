import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { KARMA, WRAM } from './wram.mjs';

// 80:CDB2: karma plus the first script argument, as a wrapping 16-bit sum without a limit.
export const addKarma = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const karma = h.add(h.longRead(WRAM + KARMA), h.dp(FIRST_ARGUMENT));
      h.longWrite(WRAM + KARMA, karma);
    },
    outerReturn,
  );
