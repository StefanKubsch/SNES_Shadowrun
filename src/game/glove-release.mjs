// The glove put away from a script (lifted from the script native 80:CD9D;
// register-level version in src/task/native-glove-release.mjs, which recorded waits
// replay): the dialog window cleared (7E:1D61), the glove put away with its target's
// name window released (80:BCB2) and the window list redrawn (81:AD92).
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { DIALOG_WINDOW } from '../task/wram.mjs';

const GLOVE_CALL = [0x80cda0, 0x80bcb2],
  LIST_CALL = [0x80cda3, 0x81ad92];

// 80:CD9D, a sequence that ends with the native's RTS; routines holds the glove's
// release (JSR) and the window list (JSL).
export function* releaseGloveSequence(h, events, routines) {
  const { wram } = h.a.mem;
  yield () => {
    wram[DIALOG_WINDOW] = 0;
    wram[DIALOG_WINDOW + 1] = 0;
  };
  yield* nativeCallSequence(h, events, routines, ...GLOVE_CALL);
  yield* nativeCallSequence(h, events, routines, ...LIST_CALL, true);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
