import { leaf } from './native-leaf-support.mjs';
import { PAD_PRESSED } from './wram.mjs';

// 80:9E5F: return the joypad buttons newly pressed this frame.
export const getPadPressed = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.result(h.load(h.longRead(h.abs(PAD_PRESSED))));
    },
    outerReturn,
  );
