import { leaf } from './native-leaf-support.mjs';
import { PAD_HELD } from './wram.mjs';

// 80:9E59: return the joypad buttons currently held.
export const getPadHeld = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.result(h.load(h.longRead(h.abs(PAD_HELD))));
    },
    outerReturn,
  );
