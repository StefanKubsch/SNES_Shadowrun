import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The dialog's main menu and topic choice (lifted from 80:91E2 and 80:9215; register-
// level versions in proof/replay/native-dialog-text.mjs stay the reference).
//
// The main menu lists Exit, Talk and Ask about (tokens 80:920D) from row 4 of the text
// window (the direct page word 17) with the menu 80:A6C7; a cancel (FFFF) sets the end
// word 7E:1D63. The chosen row stays in the direct page word 00.
//
// The topic choice lists the texts (tokens 8D:8000 by topic number) of the topics in
// the topic list 7E:3CA3 (ended by FF) whose flag in 7E:3CD6 is clear, into the menu
// buffer 7E:0154. Without such a topic the result is FFFF. Otherwise it opens a window
// (6, F, E x B; a text language may widen it), runs the menu (9 rows) on it and releases
// the window; a cancel sets the end word, else the result is the chosen topic's index in
// the topic list. The result stays in the direct page word 00.
//
// Window opening, release and menus compose directly without CPU call frames.
// Registers (user decision 2026-11-17): game state only; the menus take no register
// input and the routines leave no registers (the result is in the direct page word 00).
// The register form of the main menu for register-level callers (A the result with the
// flags of its CMP #FFFF) lives in proof/caller/upkeep-routines.mjs.
import { drawTextBufferSequence } from './text-draw.mjs';
import { chooseFromMenu, MENU } from './menu-choice.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { TOPICS } from '../data/topics.mjs';
import { openWindow } from './window-open.mjs';
import { releaseWindowSequence } from './window-release.mjs';
import { DIALOG_END, TOPIC_FLAGS, TOPIC_LIST } from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const DP_RESULT = 0x00,
  DP_TEXT_WINDOW = 0x17,
  DP_TOPIC_WINDOW = 0x1a,
  DP_TOPIC_NUMBER = 0x23,
  NONE = WORD_MASK,
  LIST_END = BYTE_MASK,
  CODE_BANK = 0x80,
  WRAM_BANK = 0x7e,
  TOPIC_TEXTS = 0x8d8000,
  TOPIC_MENU_BUFFER = 0x154;
// The menu's arguments in the direct page words 02 to 0A: column, row, visible rows and
// the tokens with their bank; the topic window in 00 to 08.
const MAIN_MENU = Object.freeze([2, 4, 3, 0x920d, CODE_BANK]),
  TOPIC_MENU = Object.freeze([1, 0, 9, TOPIC_MENU_BUFFER, WRAM_BANK]),
  TOPIC_WINDOW = Object.freeze([6, 15, 14, 11, 0]);

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
// The direct page words from 00 (or 02) on.
const setWords = (wram, from, values) =>
  values.forEach((value, n) => setWord(wram, from + 2 * n, value));

// The dialog's main menu (80:91E2) for lifted callers, without the JSR frame (the
// caller's return word lies only in free stack bytes). Selection composes directly.
export function* chooseDialogAction(h, events, renderBuffer = drawTextBufferSequence) {
  const { wram } = h.a.mem;
  yield () => {
    setWord(wram, DP_RESULT, word(wram, DP_TEXT_WINDOW));
    setWords(wram, 2, MAIN_MENU);
  };
  yield* chooseFromMenu(h, events, renderBuffer, MENU);
  yield () => {
    if (word(wram, DP_RESULT) === NONE) setWord(wram, DIALOG_END, NONE);
  };
}
// The dialog's topic choice (80:9215) for lifted callers, without the JSR frame (the
// caller's return word lies only in free stack bytes). Selection composes directly.
export function* chooseDialogTopic(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem;
  let none = false;
  // No topic: FFFF in 00.
  const empty = () => {
    setWord(wram, DP_RESULT, NONE);
    none = true;
  };
  yield () => {
    if (readStateByte(wram, TOPIC_LIST) === LIST_END) return empty();
    let x = 0,
      y = 0;
    for (; readStateByte(wram, TOPIC_LIST + x) !== LIST_END; x = (x + 1) & WORD_MASK) {
      const topic = readStateByte(wram, TOPIC_LIST + x);
      setWord(wram, DP_TOPIC_NUMBER, topic);
      if (readStateByte(wram, TOPIC_FLAGS + x)) continue;
      const at = TOPIC_TEXTS + ((topic << 1) & WORD_MASK);
      setWord(wram, TOPIC_MENU_BUFFER + y, mem.read8(at) | (mem.read8(at + 1) << BYTE_BITS));
      y = (y + 2) & WORD_MASK;
    }
    if (y === 0) return empty();
    setWord(wram, TOPIC_MENU_BUFFER + y, 0);
    setWords(wram, DP_RESULT, TOPIC_WINDOW);
    if (mem.language)
      fitListWindow(mem, listTextIds(mem, (WRAM_BANK << WORD_BITS) | TOPIC_MENU_BUFFER, TOPICS));
  };
  if (none) return;
  yield* openWindow(h, events);
  yield () => {
    setWord(wram, DP_TOPIC_WINDOW, word(wram, DP_RESULT));
    setWords(wram, 2, TOPIC_MENU);
  };
  yield* chooseFromMenu(h, events, renderBuffer, MENU);
  let chosen;
  yield () => {
    // The original keeps the chosen row on the stack over the release; that word lies
    // only in free stack bytes and is kept in a local here.
    chosen = word(wram, DP_RESULT);
    setWord(wram, DP_RESULT, word(wram, DP_TOPIC_WINDOW));
  };
  yield* releaseWindowSequence(h, events);
  yield () => {
    let row = chosen;
    if (row === NONE) {
      setWord(wram, DIALOG_END, row);
      setWord(wram, DP_RESULT, row);
      return;
    }
    // The chosen row counts the unflagged topics of the list.
    let x = 0;
    for (; ; x = (x + 1) & WORD_MASK) {
      if (readStateByte(wram, TOPIC_FLAGS + x)) continue;
      row = (row - 1) & WORD_MASK;
      if (row & WORD_SIGN) break;
    }
    setWord(wram, DP_RESULT, x);
  };
}
