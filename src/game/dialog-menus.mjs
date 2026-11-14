// The dialog's main menu and topic choice (lifted from 80:91E2 and 80:9215; register-
// level versions in src/task/native-dialog-text.mjs stay the reference).
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
// The callees come from the dialog's text routines: with the standard ones the window
// opening and release run lifted (window-open.mjs, window-release.mjs) and the menu
// register-level, through their frames; with a test's replacements those run, as the
// reference runs them. A, X and Y passed to the calls and left at the end are the
// original's, as are the carry of the routines' own comparisons; the X the topic list
// pushes around a text lookup is not reproduced (nothing waits there).
import { dialogCallBody, segmentSequence } from '../task/native-call-continuation.mjs';
import { menuComposeSequence } from '../task/native-menu-compose.mjs';
import { isStandardTextRoutines } from '../task/native-dialog-text.mjs';
import { chooseFromMenuSequence } from './menu-choice.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { TOPICS } from '../data/topics.mjs';
import { openWindowSequence } from './window-open.mjs';
import { releaseWindowSequence } from './window-release.mjs';
import { DIALOG_END, TOPIC_FLAGS, TOPIC_LIST } from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

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
// Original call sites and callees.
const MAIN_MENU_CALL = [0x8091ff, 0x80a6c7],
  TOPIC_WINDOW_CALL = [0x809278, 0x80f963],
  TOPIC_MENU_CALL = [0x809298, 0x80a6c7],
  TOPIC_RELEASE_CALL = [0x8092a1, 0x80fa3e];

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
};
// The direct page words from 00 (or 02) on.
const setWords = (wram, from, values) =>
  values.forEach((value, n) => setWord(wram, from + 2 * n, value));
function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// A callee of the text routines through its JSR frame: the lifted window opening and
// release for the standard routines, and their menu lifted with the callee table menus
// (menu-choice.mjs) or register-level without one; else the replacement.
function callee(h, events, routines, menus, [site, target], name) {
  let body;
  if (!isStandardTextRoutines(routines)) body = () => segmentSequence(() => routines[name](h.a));
  else if (name === 'allocate') body = () => openWindowSequence(h, events);
  else if (name === 'release')
    body = function* () {
      yield* releaseWindowSequence(h, events);
      return yield* rts(h);
    };
  else if (menus) body = () => chooseFromMenuSequence(h, events, menus, target);
  else body = () => menuComposeSequence(h.a, events, target, false);
  return dialogCallBody(h, site, target, body);
}

// The dialog's main menu (80:91E2), a sequence for a native call continuation.
export function* chooseDialogActionSequence(h, events, routines, menus = null) {
  const { ctx } = h,
    { wram } = h.a.mem;
  yield () => {
    setWord(wram, DP_RESULT, word(wram, DP_TEXT_WINDOW));
    setWords(wram, 2, MAIN_MENU);
    ctx.a = CODE_BANK;
  };
  yield* callee(h, events, routines, menus, MAIN_MENU_CALL, 'menu');
  yield () => {
    ctx.a = word(wram, DP_RESULT);
    // CMP #FFFF.
    flag(ctx, FLAG_CARRY, ctx.a === NONE);
    signAndZero(ctx, (ctx.a + 1) & WORD_MASK);
    if (ctx.a === NONE) setWord(wram, DIALOG_END, ctx.a);
  };
  return yield* rts(h);
}

// The dialog's topic choice (80:9215), a sequence for a native call continuation.
export function* chooseDialogTopicSequence(h, events, routines, menus = null) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  let none = false;
  // No topic: FFFF in 00, with the carry of the end comparison.
  const empty = () => {
    ctx.a = NONE;
    signAndZero(ctx, NONE);
    flag(ctx, FLAG_CARRY, true);
    setWord(wram, DP_RESULT, NONE);
    none = true;
  };
  yield () => {
    if (wram[TOPIC_LIST] === LIST_END) return empty();
    let x = 0,
      y = 0;
    for (; wram[TOPIC_LIST + x] !== LIST_END; x = (x + 1) & WORD_MASK) {
      const topic = wram[TOPIC_LIST + x];
      setWord(wram, DP_TOPIC_NUMBER, topic);
      if (wram[TOPIC_FLAGS + x]) continue;
      const at = TOPIC_TEXTS + ((topic << 1) & WORD_MASK);
      setWord(wram, TOPIC_MENU_BUFFER + y, mem.read8(at) | (mem.read8(at + 1) << BYTE_BITS));
      y = (y + 2) & WORD_MASK;
    }
    ctx.x = x;
    ctx.y = y;
    if (y === 0) return empty();
    setWord(wram, TOPIC_MENU_BUFFER + y, 0);
    setWords(wram, DP_RESULT, TOPIC_WINDOW);
    ctx.a = 0;
    // CPY #0 with Y not 0.
    flag(ctx, FLAG_CARRY, true);
    if (mem.language)
      fitListWindow(mem, h, listTextIds(mem, (WRAM_BANK << WORD_BITS) | TOPIC_MENU_BUFFER, TOPICS));
  };
  if (none) return yield* rts(h);
  yield* callee(h, events, routines, menus, TOPIC_WINDOW_CALL, 'allocate');
  yield () => {
    setWord(wram, DP_TOPIC_WINDOW, word(wram, DP_RESULT));
    setWords(wram, 2, TOPIC_MENU);
    ctx.a = WRAM_BANK;
  };
  yield* callee(h, events, routines, menus, TOPIC_MENU_CALL, 'menu');
  yield () => {
    h.a.pushWord(word(wram, DP_RESULT));
    ctx.a = word(wram, DP_TOPIC_WINDOW);
    setWord(wram, DP_RESULT, ctx.a);
  };
  yield* callee(h, events, routines, menus, TOPIC_RELEASE_CALL, 'release');
  yield () => {
    let row = h.a.pullWord();
    ctx.y = row;
    flag(ctx, FLAG_CARRY, row === NONE);
    if (row === NONE) {
      signAndZero(ctx, 0);
      setWord(wram, DIALOG_END, row);
      setWord(wram, DP_RESULT, row);
      return;
    }
    // The chosen row counts the unflagged topics of the list.
    let x = 0;
    for (; ; x = (x + 1) & WORD_MASK) {
      if (wram[TOPIC_FLAGS + x]) continue;
      row = (row - 1) & WORD_MASK;
      if (row & WORD_SIGN) break;
    }
    ctx.a = 0;
    ctx.x = x;
    ctx.y = row;
    signAndZero(ctx, row);
    setWord(wram, DP_RESULT, x);
  };
  return yield* rts(h);
}
