// The glove put away from a script (lifted from the script native 80:CD9D;
// register-level version in proof/replay/native-glove-release.mjs, which recorded waits
// replay): the dialog window cleared (7E:1D61), the glove put away with its target's
// name window released (80:BCB2) and the window list redrawn (81:AD92).
import { putGloveAwayCallSequence } from './window-release.mjs';
import { dialogCallBody } from '../system/native-call-continuation.mjs';
import { drawWindowListSequence } from './window-list.mjs';
import { DIALOG_WINDOW } from '../data/wram.mjs';

const GLOVE_CALL = [0x80cda0, 0x80bcb2],
  LIST_SITE = 0x80cda3;

// 80:CD9D, ending with the native's RTS; both cleanup callees compose directly.
export function* releaseGloveSequence(h, events) {
  const { wram } = h.a.mem;
  yield () => {
    wram[DIALOG_WINDOW] = 0;
    wram[DIALOG_WINDOW + 1] = 0;
  };
  yield* dialogCallBody(h, ...GLOVE_CALL, () => putGloveAwayCallSequence(h, events));
  yield* drawWindowListSequence(h, events, LIST_SITE);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
