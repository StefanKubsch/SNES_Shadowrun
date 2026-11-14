// A menu's list in its window (lifted from 80:A617, 80:A5DB and 80:A5F9; register-level
// versions in src/task/native-list-prerequisites.mjs stay the reference).
//
// The menus 80:A6A5 to 80:A6C7 keep their state in WRAM: the selection (a word index
// into the list, two per row), the first row of the page shown (MENU_PAGE_START), and
// the window column and row of the list's top left (MENU_COLUMN, MENU_ROW). The
// window is the one of the direct page word 00.
//
// The mark of a row (80:A5F9) and its removal (80:A5DB) take the row of the word index
// in Y: the index less the page start, halved, below the list's top row. The cursor is
// set there one column left of the list (80:FAAC, window-text.mjs) and the mark text
// 7074 or the blank 707D is printed (80:FE69, text-print.mjs, its text buffer 80:FB39
// from the table the caller passes). Both leave the direct page words 02 and 04 and the
// registers of the text print, as the original.
//
// The list drawing (80:A617) prints the page's rows from the page start on: the list's
// texts are words at the long pointer of the direct page words 08 to 0A, ended by 0;
// each row has its cursor at the list's column (80:FAAC) and its text printed (80:FE69)
// with Y pushed around it. A menu with numbers (MENU_SHOW_NUMBERS) prints a row's
// number from the list of the direct page word 0C (data bank) after a blank, when it
// is not 0 (80:FD80, window-text.mjs). After as many rows as the direct page word 06
// allows, a further text shows the more mark 707A three columns and rows before the
// window's right bottom corner; a page start other than 0 shows the previous mark 7077
// three columns before its right top corner. The direct page words 02 and 04, the draw
// row and the rows left are written as the original; the registers are those of the
// last call, or after a first page A 0 with zero set and X, Y, the carry and the
// overflow of what ran last.
import { dialogCallBody, segmentSequence } from '../task/native-call-continuation.mjs';
import { printNumberSequence, setTextCursorRoutine } from './window-text.mjs';
import { printTextSequence } from './text-print.mjs';
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
} from '../task/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const DP_TEXT = 2;
// The texts and the call sites of the mark and its removal.
export const MARK = Object.freeze({
    text: 0x7074,
    cursor: [0x80a60b, 0x80faac],
    print: [0x80a613, 0x80fe69],
  }),
  UNMARK = Object.freeze({
    text: 0x707d,
    cursor: [0x80a5ed, 0x80faac],
    print: [0x80a5f5, 0x80fe69],
  });

// The list drawing's texts and call sites.
const BLANK = 0x707d,
  MORE = 0x707a,
  PREVIOUS = 0x7077,
  // The marks lie three columns and rows inside the window's far edges.
  MARK_INSET = 3,
  ROW_CURSOR = [0x80a633, 0x80faac],
  ROW_TEXT = [0x80a63d, 0x80fe69],
  NUMBER_BLANK = [0x80a650, 0x80fe69],
  NUMBER = [0x80a659, 0x80fd80],
  MORE_CURSOR = [0x80a67c, 0x80faac],
  MORE_TEXT = [0x80a684, 0x80fe69],
  PREVIOUS_CURSOR = [0x80a699, 0x80faac],
  PREVIOUS_TEXT = [0x80a6a1, 0x80fe69];

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const signAndZero = (ctx, value) => {
  ctx.status = value & WORD_SIGN ? ctx.status | FLAG_NEGATIVE : ctx.status & ~FLAG_NEGATIVE;
  ctx.status = value === 0 ? ctx.status | FLAG_ZERO : ctx.status & ~FLAG_ZERO;
};
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// Mark the row of the word index in Y, or remove its mark (80:A5F9 with MARK, 80:A5DB
// with UNMARK), a sequence for a native call continuation, called with JSR: routines
// the table with 80:FB39.
export function* markRowSequence(h, events, routines, form) {
  const { ctx } = h,
    { wram } = h.a.mem;
  yield () => {
    const row = ((ctx.y - word(wram, MENU_PAGE_START)) & WORD_MASK) >>> 1;
    setWord(wram, DP_CURSOR_ROW, row + word(wram, MENU_ROW));
    ctx.a = (word(wram, MENU_COLUMN) - 1) & WORD_MASK;
    setWord(wram, DP_TEXT, ctx.a);
  };
  yield* dialogCallBody(h, ...form.cursor, () => segmentSequence(() => setTextCursorRoutine(h)));
  yield () => {
    ctx.a = form.text;
    setWord(wram, DP_TEXT, ctx.a);
  };
  yield* dialogCallBody(h, ...form.print, () => printTextSequence(h, events, routines));
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// Draw the menu's list (80:A617), a sequence for a native call continuation, called
// with JSR: routines the table with 80:FB39.
export function* drawListSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  const listWord = (at) =>
      mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS),
    token = () =>
      listWord((word(wram, DP_LIST_TOKENS) | (wram[DP_LIST_TOKEN_BANK] << WORD_BITS)) + ctx.y),
    // The numbers through the data bank, as the original's LDA abs,Y.
    number = () => listWord(((ctx.bank << WORD_BITS) | word(wram, DP_LIST_VALUES)) + ctx.y),
    load = (value) => {
      ctx.a = value & WORD_MASK;
      signAndZero(ctx, ctx.a);
    };
  const cursor = (site) =>
    dialogCallBody(h, ...site, () => segmentSequence(() => setTextCursorRoutine(h)));
  // A text or number with Y pushed around its call (PHY, PLY), or without.
  function* print(site, body, keepY) {
    if (keepY) yield () => h.a.pushWord(ctx.y);
    yield* dialogCallBody(h, ...site, body);
    if (keepY)
      yield () => {
        ctx.y = h.a.pullWord();
        signAndZero(ctx, ctx.y);
      };
  }
  const text = (site, keepY) => print(site, () => printTextSequence(h, events, routines), keepY);
  // A mark three columns before the window's right edge, in the row given.
  const corner = function* (row, cursorSite, textSite, mark) {
    yield () => {
      ctx.x = word(wram, 0);
      load(word(wram, WINDOW_COLUMNS + ctx.x) - MARK_INSET);
      setWord(wram, DP_TEXT, ctx.a);
      setWord(wram, DP_CURSOR_ROW, row(ctx.x));
    };
    yield* cursor(cursorSite);
    yield () => {
      load(mark);
      setWord(wram, DP_TEXT, ctx.a);
    };
    yield* text(textSite, false);
  };

  yield () => {
    setWord(wram, MENU_DRAW_ROW, word(wram, MENU_ROW));
    setWord(wram, MENU_ROWS_REMAINING, word(wram, DP_MENU_VISIBLE_ROWS));
    ctx.y = word(wram, MENU_PAGE_START);
    signAndZero(ctx, ctx.y);
  };
  for (;;) {
    let end = false;
    yield () => {
      setWord(wram, DP_TEXT, word(wram, MENU_COLUMN));
      const row = word(wram, MENU_DRAW_ROW);
      setWord(wram, DP_CURSOR_ROW, row);
      load(row + 1);
      setWord(wram, MENU_DRAW_ROW, ctx.a);
    };
    yield* cursor(ROW_CURSOR);
    yield () => {
      load(token());
      end = ctx.a === 0;
      if (!end) setWord(wram, DP_TEXT, ctx.a);
    };
    if (end) break;
    yield* text(ROW_TEXT, true);
    let numbered = false;
    yield () => {
      load(word(wram, MENU_SHOW_NUMBERS));
      if (ctx.a) load(number());
      numbered = ctx.a !== 0;
      if (numbered) {
        load(BLANK);
        setWord(wram, DP_TEXT, ctx.a);
      }
    };
    if (numbered) {
      yield* text(NUMBER_BLANK, true);
      yield () => {
        load(number());
        setWord(wram, DP_TEXT, ctx.a);
      };
      yield* print(NUMBER, () => printNumberSequence(h, events, routines), true);
    }
    let more = false;
    yield () => {
      ctx.y = (ctx.y + 2) & WORD_MASK;
      const left = (word(wram, MENU_ROWS_REMAINING) - 1) & WORD_MASK;
      setWord(wram, MENU_ROWS_REMAINING, left);
      signAndZero(ctx, left);
      if (left) return;
      load(token());
      more = ctx.a !== 0;
      end = true;
    };
    if (more)
      yield* corner(
        (x) => (word(wram, WINDOW_ROWS + x) - MARK_INSET) & WORD_MASK,
        MORE_CURSOR,
        MORE_TEXT,
        MORE,
      );
    if (end) break;
  }
  let previous = false;
  yield () => {
    load(word(wram, MENU_PAGE_START));
    previous = ctx.a !== 0;
  };
  if (previous) yield* corner(() => 0, PREVIOUS_CURSOR, PREVIOUS_TEXT, PREVIOUS);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
