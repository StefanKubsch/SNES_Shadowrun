// Lifted runner resource natives and their window-list redraw (80:CECB, 80:D079).
import { raiseStateCountBody } from '../script/native-state-count-raise.mjs';
import { restoreRunnersBody } from '../script/native-runners-restore.mjs';
import { dialogCallSequence } from '../system/native-call-continuation.mjs';
import { runDrawWindowList } from './window-list.mjs';

const LIST_ROUTINES = new Map([[0x81ad92, runDrawWindowList]]);
function* redrawAndReturn(h, events, body, callSite) {
  yield () => body(h);
  yield* dialogCallSequence(h, events, LIST_ROUTINES, callSite, 0x81ad92, true);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
export const raiseStateCountSequence = (h, events) =>
  redrawAndReturn(h, events, raiseStateCountBody, 0x80cf29);
export const restoreRunnersSequence = (h, events) =>
  redrawAndReturn(h, events, restoreRunnersBody, 0x80d085);
