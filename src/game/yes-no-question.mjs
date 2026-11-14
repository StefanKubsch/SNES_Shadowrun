// The Yes/No question (lifted from the script native 80:CD43; register-level version in
// src/task/native-modal.mjs, which recorded waits replay).
//
// A window of six columns and four rows opens at the caller's place (the direct page
// words 02 and 04; the text language may widen it, src/data/menu-layout.mjs) and the
// plain menu 80:A6C7 lists Yes and No (the list 80:CD91 with the texts 714D and 7150) in
// two visible rows from column 1. The window is released afterwards; the result is FFFF
// for Yes and 0 for No or a cancel.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { fitListWindow } from '../data/menu-layout.mjs';
import {
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_MENU_COLUMN,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK } from '../constants/bits.mjs';

const WINDOW_COLUMNS = 6,
  WINDOW_ROWS = 4,
  VISIBLE_ROWS = 2,
  MENU_COLUMN = 1,
  YES_NO_ITEMS = 0x80cd91,
  YES_NO_TEXTS = [0x714d, 0x7150, 0],
  // The window (from 80:F963 in the direct page word 00) is kept in the word 0E.
  DP_WINDOW = 0x00,
  DP_QUESTION_WINDOW = 0x0e,
  YES = WORD_MASK,
  NO = 0,
  // The menu's answer for No (row 1) and a cancel.
  NO_ROW = 1,
  CANCEL = WORD_MASK,
  BANK_SHIFT = 16;
// Original call sites and callees.
const WINDOW_CALL = [0x80cd52, 0x80f963],
  MENU_CALL = [0x80cd6f, 0x80a6c7],
  RELEASE_CALL = [0x80cd8a, 0x80fa3e];

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};

// 80:CD43, a sequence that ends with the native's RTS; routines holds the window
// opening, the plain menu and the release.
export function* askYesNoSequence(h, events, routines) {
  const { mem } = h.a,
    { wram } = mem,
    call = ([site, target]) => nativeCallSequence(h, events, routines, site, target);
  yield () => {
    setWord(wram, DP_WINDOW_COLUMNS, WINDOW_COLUMNS);
    setWord(wram, DP_WINDOW_ROWS, WINDOW_ROWS);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
    fitListWindow(mem, h, YES_NO_TEXTS);
  };
  yield* call(WINDOW_CALL);
  yield () => {
    setWord(wram, DP_QUESTION_WINDOW, word(wram, DP_WINDOW));
    setWord(wram, DP_MENU_COLUMN, MENU_COLUMN);
    setWord(wram, DP_MENU_ROW, 0);
    setWord(wram, DP_MENU_VISIBLE_ROWS, VISIBLE_ROWS);
    setWord(wram, DP_LIST_TOKENS, YES_NO_ITEMS & WORD_MASK);
    setWord(wram, DP_LIST_TOKEN_BANK, YES_NO_ITEMS >>> BANK_SHIFT);
  };
  yield* call(MENU_CALL);
  yield () => {
    const choice = word(wram, DP_WINDOW);
    // The answer waits on the stack (PEA) while the window is released.
    h.a.pushWord(choice === CANCEL || choice === NO_ROW ? NO : YES);
    setWord(wram, DP_WINDOW, word(wram, DP_QUESTION_WINDOW));
  };
  yield* call(RELEASE_CALL);
  let result;
  yield () => {
    setWord(wram, DP_WINDOW, h.a.pullWord());
    result = h.rts();
  };
  return result;
}
