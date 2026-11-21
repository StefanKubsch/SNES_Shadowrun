// Lifted runner resource natives and their window-list redraw (80:CECB, 80:D079).
import { raiseStateCountBody } from '../script/native-state-count-raise.mjs';
import { restoreRunnersBody } from '../script/native-runners-restore.mjs';
import { drawWindowListSequence } from './window-list.mjs';

// The body and the redraw without the JSR frame, for lifted callers.
function* redraw(h, events, body) {
  yield () => body(h);
  yield* drawWindowListSequence(h, events);
}
function* redrawAndReturn(h, events, body, outerReturn) {
  yield* redraw(h, events, body);
  let result;
  yield () => {
    if (outerReturn) result = h.rts();
  };
  return result;
}
// 80:CECB for lifted callers: the caller's return word lies only in free stack bytes.
export const raiseStateCountAndRedraw = (h, events) => redraw(h, events, raiseStateCountBody);
export const raiseStateCountSequence = (h, events, outerReturn = true) =>
  redrawAndReturn(h, events, raiseStateCountBody, outerReturn);
export const restoreRunnersSequence = (h, events, outerReturn = true) =>
  redrawAndReturn(h, events, restoreRunnersBody, outerReturn);
