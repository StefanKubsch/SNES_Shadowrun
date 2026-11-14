import { leaf } from './native-leaf-support.mjs';
import { GLOVE_SCREEN_Y } from './wram.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 80:C100: return the screen Y position (one byte) of the glove sprite.
export const getGloveScreenY = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const word = h.load(h.longRead(h.abs(GLOVE_SCREEN_Y)));
      h.result(h.load(word & BYTE_MASK));
    },
    outerReturn,
  );
