// Lifted runner resource natives and their window-list redraw (80:CECB, 80:D079).
import { raiseStateCountBody } from '../script/native-state-count-raise.mjs';
import { restoreRunnersBody } from '../script/native-runners-restore.mjs';
import { drawWindowListSequence } from './window-list.mjs';

// The body and the redraw without the JSR frame, for lifted callers.
function* redraw(h, events, body) {
  yield () => body(h);
  yield* drawWindowListSequence(h, events);
}
function* redrawAndReturn(h, events, body) {
  yield* redraw(h, events, body);
}
// 80:CECB for lifted callers: the caller's return word lies only in free stack bytes.
export const raiseStateCountAndRedraw = (h, events) => redraw(h, events, raiseStateCountBody);
export const raiseStateCountSequence = (h, events) =>
  redrawAndReturn(h, events, raiseStateCountBody);
export const restoreRunnersSequence = (h, events) => redrawAndReturn(h, events, restoreRunnersBody);
