import { readStateByte, writeStateByte } from '../state/objects.mjs';
// A menu's list in its window (lifted from 80:A617, 80:A5DB and 80:A5F9; register-level
// versions in proof/replay/native-list-prerequisites.mjs stay the reference).
//
// The menus 80:A6A5 to 80:A6C7 keep their state in WRAM: the selection (a word index
// into the list, two per row), the first row of the page shown (MENU_PAGE_START), and
// the window column and row of the list's top left (MENU_COLUMN, MENU_ROW). The
// window is the one of the direct page word 00.
//
// The mark of a row (80:A5F9) and its removal (80:A5DB) take the row's word index (Y in
// the original): the index less the page start, halved, below the list's top row. The
// cursor is set there one column left of the list (80:FAAC, window-text.mjs) and the
// mark text 7074 or the blank 707D is printed (80:FE69, text-print.mjs, its text buffer
// 80:FB39 from the renderer sequence the caller passes). Both leave the direct page
// words 02 and 04 as the original.
//
// The list drawing (80:A617) prints the page's rows from the page start on: the list's
// texts are words at the long pointer of the direct page words 08 to 0A, ended by 0;
// each row has its cursor at the list's column (80:FAAC) and its text printed (80:FE69)
// with the list position pushed around it. A menu with numbers (MENU_SHOW_NUMBERS)
// prints a row's number from the list of the direct page word 0C (data bank) after a
// blank, when it is not 0 (80:FD80, window-text.mjs). After as many rows as the direct
// page word 06 allows, a further text shows the more mark 707A three columns and rows
// before the window's right bottom corner; a page start other than 0 shows the previous
// mark 7077 three columns before its right top corner. The direct page words 02 and 04,
// the draw row and the rows left are written as the original.
//
// Registers (user decision 2026-11-17): game state only; the routines take the row's
// word index as a parameter and leave no A, X, Y or flags. The list position's pushes
// around the prints stay on the stack.
import { segmentSequence } from '../system/native-call-continuation.mjs';
import { printNumber, setTextCursor } from './window-text.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { printText } from './text-print.mjs';
import {
  DP_CURSOR_ROW,
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_LIST_VALUES,
  DP_MENU_VISIBLE_ROWS,
  MENU_COLUMN,
  MENU_DRAW_ROW,
  MENU_PAGE_START,
  MENU_ROW,
  MENU_ROWS_REMAINING,
  MENU_SHOW_NUMBERS,
  WINDOW_COLUMNS,
  WINDOW_ROWS,
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

const DP_TEXT = 2;
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

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// Mark the row of the word index given, or remove its mark (80:A5F9 with MARK, 80:A5DB
// with UNMARK), a sequence for a native call continuation, called with JSR.
// renderBuffer is the text-buffer renderer sequence.
export function* markRowSequence(h, events, renderBuffer = drawTextBufferSequence, form, index) {
  const { wram } = h.a.mem;
  yield () => {
    const row = ((index - word(wram, MENU_PAGE_START)) & WORD_MASK) >>> 1;
    setWord(wram, DP_CURSOR_ROW, row + word(wram, MENU_ROW));
    setWord(wram, DP_TEXT, word(wram, MENU_COLUMN) - 1);
  };
  yield* segmentSequence(() => setTextCursor(h));
  yield () => setWord(wram, DP_TEXT, form.text);
  yield* printText(h, events, renderBuffer);
  return yield* rts(h);
}
function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// Draw the menu's list (80:A617), a sequence for a native call continuation, called
// with JSR, receiving the renderer sequence.
export function* drawListSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  // The list position (Y in the original).
  let at = 0;
  const listWord = (address) =>
      mem.read8(address & LONG_MASK) | (mem.read8((address + 1) & LONG_MASK) << BYTE_BITS),
    token = () =>
      listWord(
        (word(wram, DP_LIST_TOKENS) | (readStateByte(wram, DP_LIST_TOKEN_BANK) << WORD_BITS)) + at,
      ),
    // The numbers through the data bank, as the original's LDA abs,Y.
    number = () => listWord(((ctx.bank << WORD_BITS) | word(wram, DP_LIST_VALUES)) + at);
  const cursor = () => segmentSequence(() => setTextCursor(h));
  // A text. The original keeps the list position on the stack around some texts and
  // numbers (PHY, PLY); that word lies only in free stack bytes, and the position is a
  // local here.
  const text = () => printText(h, events, renderBuffer);
  // A mark three columns before the window's right edge, in the row given.
  const corner = function* (row, mark) {
    yield () => {
      const x = word(wram, 0);
      setWord(wram, DP_TEXT, word(wram, WINDOW_COLUMNS + x) - MARK_INSET);
      setWord(wram, DP_CURSOR_ROW, row(x));
    };
    yield* cursor();
    yield () => setWord(wram, DP_TEXT, mark);
    yield* text();
  };

  yield () => {
    setWord(wram, MENU_DRAW_ROW, word(wram, MENU_ROW));
    setWord(wram, MENU_ROWS_REMAINING, word(wram, DP_MENU_VISIBLE_ROWS));
    at = word(wram, MENU_PAGE_START);
  };
  for (;;) {
    let end = false;
    yield () => {
      setWord(wram, DP_TEXT, word(wram, MENU_COLUMN));
      const row = word(wram, MENU_DRAW_ROW);
      setWord(wram, DP_CURSOR_ROW, row);
      setWord(wram, MENU_DRAW_ROW, row + 1);
    };
    yield* cursor();
    yield () => {
      const value = token();
      end = value === 0;
      if (!end) setWord(wram, DP_TEXT, value);
    };
    if (end) break;
    yield* text();
    let numbered = false;
    yield () => {
      numbered = word(wram, MENU_SHOW_NUMBERS) !== 0 && number() !== 0;
      if (numbered) setWord(wram, DP_TEXT, BLANK);
    };
    if (numbered) {
      yield* text();
      yield () => setWord(wram, DP_TEXT, number());
      yield* printNumber(h, events, renderBuffer);
    }
    let more = false;
    yield () => {
      at = (at + 2) & WORD_MASK;
      const left = (word(wram, MENU_ROWS_REMAINING) - 1) & WORD_MASK;
      setWord(wram, MENU_ROWS_REMAINING, left);
      if (left) return;
      more = token() !== 0;
      end = true;
    };
    if (more) yield* corner((x) => (word(wram, WINDOW_ROWS + x) - MARK_INSET) & WORD_MASK, MORE);
    if (end) break;
  }
  let previous = false;
  yield () => {
    previous = word(wram, MENU_PAGE_START) !== 0;
  };
  if (previous) yield* corner(() => 0, PREVIOUS);
  return yield* rts(h);
}
