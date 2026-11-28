import { windowState } from '../state/windows.mjs';
import { navigationState } from '../state/menu.mjs';
// Shared menu selection and drawing over named state, with the existing input,
// sound, paging and repeat behaviour. Caller argument encoding stays in its bridge.
import { segmentSequence } from '../system/sequence-runner.mjs';
import { printNumber, setTextCursor } from './window-text.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { printText } from './text-print.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

// The texts and the call sites of the mark and its removal.
export const MARK = Object.freeze({
    text: 0x7074,
    cursor: [0x80a60b, 0x80faac],
  }),
  UNMARK = Object.freeze({
    text: 0x707d,
    cursor: [0x80a5ed, 0x80faac],
  });

// The list drawing's texts and call sites.
const BLANK = 0x707d,
  MORE = 0x707a,
  PREVIOUS = 0x7077,
  // The marks lie three columns and rows inside the window's far edges.
  MARK_INSET = 3;

// Mark the row of the word index given, or remove its mark (80:A5F9 with MARK, 80:A5DB
// with UNMARK), a direct sequence without a CPU call frame.
// renderBuffer is the text-buffer renderer sequence.
export function* markRow(h, events, renderBuffer = drawTextBuffer, form, index) {
  const state = navigationState(h.a);
  yield () => {
    const row = ((index - state.pageStart) & WORD_MASK) >>> 1;
    state.argumentRow = row + state.row;
    state.argument = state.column - 1;
  };
  yield* segmentSequence(() => setTextCursor(h));
  yield () => (state.argument = form.text);
  yield* printText(h, events, renderBuffer);
}

// Draw the menu's list (80:A617) directly, receiving the renderer sequence.
export function* drawList(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    state = navigationState(h.a);
  // The list position (Y in the original).
  let at = 0;
  const token = () => state.textAt(at),
    number = () => state.valueAt(at);
  const cursor = () => segmentSequence(() => setTextCursor(h));
  // A text. The original keeps the list position on the stack around some texts and
  // numbers (PHY, PLY); that word lies only in free stack bytes, and the position is a
  // local here.
  const text = () => printText(h, events, renderBuffer);
  // A mark three columns before the window's right edge, in the row given.
  const corner = function* (row, mark) {
    yield () => {
      const x = state.window;
      state.argument = windowState(mem, x).columns - MARK_INSET;
      state.argumentRow = row(x);
    };
    yield* cursor();
    yield () => (state.argument = mark);
    yield* text();
  };

  yield () => {
    state.drawRow = state.row;
    state.rowsRemaining = state.visibleRows;
    at = state.pageStart;
  };
  for (;;) {
    let end = false;
    yield () => {
      state.argument = state.column;
      const row = state.drawRow;
      state.argumentRow = row;
      state.drawRow = row + 1;
    };
    yield* cursor();
    yield () => {
      const value = token();
      end = value === 0;
      if (!end) state.argument = value;
    };
    if (end) break;
    yield* text();
    let numbered = false;
    yield () => {
      numbered = state.showNumbers !== 0 && number() !== 0;
      if (numbered) state.argument = BLANK;
    };
    if (numbered) {
      yield* text();
      yield () => (state.argument = number());
      yield* printNumber(h, events, renderBuffer);
    }
    let more = false;
    yield () => {
      at = (at + 2) & WORD_MASK;
      const left = (state.rowsRemaining - 1) & WORD_MASK;
      state.rowsRemaining = left;
      if (left) return;
      more = token() !== 0;
      end = true;
    };
    if (more) yield* corner((x) => (windowState(mem, x).rows - MARK_INSET) & WORD_MASK, MORE);
    if (end) break;
  }
  let previous = false;
  yield () => {
    previous = state.pageStart !== 0;
  };
  if (previous) yield* corner(() => 0, PREVIOUS);
}
