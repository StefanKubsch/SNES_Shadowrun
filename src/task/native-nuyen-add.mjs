import { FIRST_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { NUYEN, WRAM } from './wram.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

const NUYEN_LOW = WRAM + NUYEN,
  NUYEN_HIGH = NUYEN_LOW + 2,
  MAXIMUM_WORD = WORD_MASK;

// 80:CCDB: the 32-bit nuyen balance plus the first script argument. A carry
// increments the high word; if that wraps, both words saturate at the maximum.
export const addNuyen = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      let low = h.add(h.longRead(NUYEN_LOW), h.dp(FIRST_ARGUMENT));
      if (h.carried()) {
        h.longWrite(NUYEN_LOW, low);
        const high = h.load((h.longRead(NUYEN_HIGH) + 1) & WORD_MASK);
        h.longWrite(NUYEN_HIGH, high);
        if (high !== 0) return;
        // The ROM stores the wrapped high word before the saturated one.
        low = h.load(MAXIMUM_WORD);
        h.longWrite(NUYEN_HIGH, MAXIMUM_WORD);
      }
      h.longWrite(NUYEN_LOW, low);
    },
    outerReturn,
  );
