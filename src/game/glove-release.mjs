// Clear the dialog handle, release the glove and redraw the remaining windows.
import { gloveState } from '../state/glove.mjs';
import { putGloveAwaySequence } from './window-release.mjs';
import { drawWindowListSequence } from './window-list.mjs';

// 80:CD9D, ending with the native's RTS; both cleanup callees compose directly.
export function* releaseGloveSequence(h, events) {
  const glove = gloveState(h.a.mem);
  yield () => {
    glove.dialogWindow = 0;
  };
  yield* putGloveAwaySequence(h, events);
  yield* drawWindowListSequence(h, events);
}
