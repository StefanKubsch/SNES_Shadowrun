import { writeStateByte } from '../state/objects.mjs';
// The glove put away from a script (lifted from the script native 80:CD9D;
// register-level version in proof/replay/native-glove-release.mjs, which recorded waits
// replay): the dialog window cleared (7E:1D61), the glove put away with its target's
// name window released (80:BCB2) and the window list redrawn (81:AD92).
import { putGloveAwaySequence } from './window-release.mjs';
import { drawWindowListSequence } from './window-list.mjs';
import { DIALOG_WINDOW } from '../data/wram.mjs';

// 80:CD9D, ending with the native's RTS; both cleanup callees compose directly.
export function* releaseGloveSequence(h, events) {
  const { wram } = h.a.mem;
  yield () => {
    writeStateByte(wram, DIALOG_WINDOW, 0);
    writeStateByte(wram, DIALOG_WINDOW + 1, 0);
  };
  yield* putGloveAwaySequence(h, events);
  yield* drawWindowListSequence(h, events);
}
