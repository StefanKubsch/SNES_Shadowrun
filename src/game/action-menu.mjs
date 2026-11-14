// The action menu of the glove (lifted from 80:99EB; register-level version in
// src/task/native-actions.mjs, which the script's native 13 at 80:9BA0 still uses).
//
// The accepted actions come in A (or the override 7E:1FA6, which the glove action sets
// for offered ones). The menu lists Exit and then, in a fixed order, the accepted ones:
// examine (80), pick up (10), talk (2), buy (20), give (40), use (100), cast a spell
// (both 200 and 400) or else open (200) and close (400), target (2000) and move to
// (4000), with their texts and hotkeys in the tables 7E:1F6A, 7E:1F98 and 7E:1F82.
// Without an accepted action the menu does not open and A is 0. Otherwise a window
// (12, 3, 11 columns, two rows more than the actions) opens (80:F963, lifted in
// window-open.mjs), the menu runs on it (80:A6A5 from the routine table, through its frame),
// the window is released (80:FA3E, lifted in window-release.mjs) and A is the chosen
// action's flag (Exit and a cancel give 0); the override is cleared. A text language
// may widen the window (src/data/menu-layout.mjs).
//
// Registers: the menu leaves A the chosen flag with its sign and zero and X, Y, the
// carry and the overflow of the window release, as the original; without an accepted
// action A 0 with zero set, Y the table index, the carry clear and X and the overflow
// unchanged. The chosen flag is pushed around the release, as the original. The calls
// get the registers the original passes them.
import { dialogCallBody, nativeCallSequence } from '../task/native-call-continuation.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { releaseWindowSequence } from './window-release.mjs';
import {
  ACTION_MENU_FLAGS,
  ACTION_MENU_HOTKEYS,
  ACTION_MENU_NAMES,
  ACTION_MENU_OVERRIDE,
  DP_ACTION_MENU_MASK,
  DP_ACTION_MENU_WINDOW,
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_LIST_VALUES,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// The actions in the menu's order: their flags, texts (offsets from 9D:8000, with their
// hotkey glyphs, assets/vm-texts.json) and hotkeys.
const ACTIONS = Object.freeze([
  [0x80, 0x70d9, 0x20], // examine
  [0x10, 0x70c5, 0x10], // pick up
  [0x02, 0x708c, 0], // talk
  [0x20, 0x70d1, 0], // buy
  [0x40, 0x70d4, 0], // give
  [0x100, 0x70e3, 0], // use
]);
const CAST_SPELL = [0x600, 0x7109, 0],
  OPEN_CLOSE = Object.freeze([
    [0x200, 0x70e6, 0x10], // open
    [0x400, 0x70f1, 0x10], // close
  ]),
  MOVES = Object.freeze([
    [0x2000, 0x70fd, 0], // target
    [0x4000, 0x7103, 0], // move to
  ]);
// The window and the menu's arguments.
const WINDOW = Object.freeze({ left: 12, top: 3, columns: 11, attributes: 0 }),
  EXTRA_ROWS = 2,
  MENU_COLUMN = 1,
  VISIBLE_ROWS = 8,
  WRAM_BANK = 0x7e,
  NONE = WORD_MASK,
  // CPY #3: at least one action after Exit (the index counts in words).
  FIRST_ACTION_END = 3,
  DP_LEFT = 0x00,
  DP_TOP = 0x02;
// Original call sites and callees.
const WINDOW_CALL = [0x809b5b, 0x80f963],
  MENU_CALL = [0x809b7d, 0x80a6a5],
  RELEASE_SITE = 0x809b94,
  RELEASE_TARGET = 0x80fa3e;

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

// Fill the menu's tables from the accepted actions; returns the table index past the
// last action.
function listActions(wram, accepted) {
  let y = 0;
  const append = ([action, text, hotkey]) => {
    setWord(wram, ACTION_MENU_NAMES + y, text);
    setWord(wram, ACTION_MENU_FLAGS + y, action);
    setWord(wram, ACTION_MENU_HOTKEYS + y, hotkey);
    y += 2;
  };
  append([0, TEXT_EXIT, 0]);
  const offer = (action) => {
    if (accepted & action[0]) append(action);
  };
  ACTIONS.forEach(offer);
  if ((accepted & CAST_SPELL[0]) === CAST_SPELL[0]) append(CAST_SPELL);
  else OPEN_CLOSE.forEach(offer);
  MOVES.forEach(offer);
  return y;
}

// Choose an action from the menu (80:99EB), a sequence for a native call continuation:
// h the caller's access (direct page 0, data bank 80), routines the table with the
// window opening and the menu.
export function* chooseActionSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  let count = 0;
  yield () => {
    setWord(wram, DP_ACTION_MENU_MASK, ctx.a);
    const override = word(wram, ACTION_MENU_OVERRIDE);
    if (override) setWord(wram, DP_ACTION_MENU_MASK, override);
    const y = listActions(wram, word(wram, DP_ACTION_MENU_MASK));
    ctx.y = y;
    if (y < FIRST_ACTION_END) {
      ctx.a = 0;
      signAndZero(ctx, 0);
      flag(ctx, FLAG_CARRY, false);
      return;
    }
    count = y >>> 1;
    setWord(wram, ACTION_MENU_NAMES + y, 0);
    // LSR, ADC 2: the carry and overflow stay clear for these small counts.
    setWord(wram, DP_WINDOW_ROWS, count + EXTRA_ROWS);
    flag(ctx, FLAG_CARRY, false);
    flag(ctx, FLAG_OVERFLOW, false);
    setWord(wram, DP_LEFT, WINDOW.left);
    setWord(wram, DP_TOP, WINDOW.top);
    setWord(wram, DP_WINDOW_COLUMNS, WINDOW.columns);
    setWord(wram, DP_WINDOW_ATTRIBUTES, WINDOW.attributes);
    ctx.a = WINDOW.attributes;
    fitListWindow(
      mem,
      h,
      mem.language ? listTextIds(mem, (WRAM_BANK << 16) | ACTION_MENU_NAMES, count) : [],
    );
  };
  if (!count) return yield* rts(h);
  yield* nativeCallSequence(h, events, routines, ...WINDOW_CALL);
  yield () => {
    setWord(wram, DP_ACTION_MENU_WINDOW, word(wram, DP_LEFT));
    setWord(wram, DP_TOP, MENU_COLUMN);
    setWord(wram, DP_MENU_ROW, 0);
    setWord(wram, DP_MENU_VISIBLE_ROWS, VISIBLE_ROWS);
    setWord(wram, DP_LIST_TOKENS, ACTION_MENU_NAMES);
    setWord(wram, DP_LIST_TOKEN_BANK, WRAM_BANK);
    setWord(wram, DP_LIST_VALUES, ACTION_MENU_HOTKEYS);
    ctx.a = ACTION_MENU_HOTKEYS;
  };
  yield* nativeCallSequence(h, events, routines, ...MENU_CALL);
  yield () => {
    // The chosen row (a cancel counts as Exit) as a table index; the window to release.
    let row = word(wram, DP_LEFT);
    if (row === NONE) row = 0;
    ctx.y = (row << 1) & WORD_MASK;
    h.a.pushWord(word(wram, ACTION_MENU_FLAGS + ctx.y));
    ctx.a = word(wram, DP_ACTION_MENU_WINDOW);
    setWord(wram, DP_LEFT, ctx.a);
  };
  yield* dialogCallBody(h, RELEASE_SITE, RELEASE_TARGET, () => releaseThenReturn(h, events));
  yield () => {
    ctx.a = h.a.pullWord();
    signAndZero(ctx, ctx.a);
    setWord(wram, ACTION_MENU_OVERRIDE, 0);
  };
  return yield* rts(h);
}
// The action menu as the script native 80:9BA0, a sequence: no override, the mask from
// the first argument, the menu (JSR at 80:9BA5) and the chosen flag as the result.
const SCRIPT_MENU_CALL = [0x809ba5, 0x8099eb];
export function* chooseScriptActionSequence(h, events, routines) {
  const { wram } = h.a.mem;
  yield () => {
    setWord(wram, ACTION_MENU_OVERRIDE, 0);
    h.ctx.a = word(wram, 0);
  };
  yield* dialogCallBody(h, ...SCRIPT_MENU_CALL, () => chooseActionSequence(h, events, routines));
  let result;
  yield () => {
    setWord(wram, 0, h.ctx.a);
    result = h.rts();
  };
  return result;
}
// The lifted window release as a JSR callee: it returns with its RTS.
function* releaseThenReturn(h, events) {
  yield* releaseWindowSequence(h, events);
  return yield* rts(h);
}
function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
