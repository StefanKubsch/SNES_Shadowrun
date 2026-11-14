import { leaf } from './native-leaf-support.mjs';
import { GLOVE_SCREEN_X } from './wram.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 80:C0F7: return the screen X position (one byte) of the glove sprite.
export const getGloveScreenX = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const word = h.load(h.longRead(h.abs(GLOVE_SCREEN_X)));
      h.result(h.load(word & BYTE_MASK));
    },
    outerReturn,
  );
