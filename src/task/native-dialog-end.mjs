import { leaf } from './native-leaf-support.mjs';
import { DIALOG_END } from './wram.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

const DIALOG_ENDED = WORD_MASK;

// 80:CDCF: end the running dialog or menu.
export const endDialog = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.longWrite(h.abs(DIALOG_END), h.load(DIALOG_ENDED));
    },
    outerReturn,
  );
