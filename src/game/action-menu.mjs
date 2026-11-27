import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The action menu of the glove (lifted from 80:99EB; register-level version in
// proof/replay/native-actions.mjs, which the script's native 13 at 80:9BA0 still uses).
//
// The accepted actions come in A (or the override 7E:1FA6, which the glove action sets
// for offered ones). The menu lists Exit and then, in a fixed order, the accepted ones:
// examine (80), pick up (10), talk (2), buy (20), give (40), use (100), cast a spell
// (both 200 and 400) or else open (200) and close (400), target (2000) and move to
// (4000), with their texts and hotkeys in the tables 7E:1F6A, 7E:1F98 and 7E:1F82.
// Without an accepted action the menu does not open and A is 0. Otherwise a window
// (12, 3, 11 columns, two rows more than the actions) opens (80:F963, lifted in
// window-open.mjs), the menu runs on it (80:A6A5, composed directly through its frame),
// the window is released (80:FA3E, lifted in window-release.mjs) and A is the chosen
// action's flag (Exit and a cancel give 0); the override is cleared. A text language
// may widen the window (src/data/menu-layout.mjs).
//
// Registers (user decision 2026-11-17): game state only. The accepted actions (A in the
// original) are a parameter and the chosen flag is returned in choice.action; the menu
// leaves no registers. The flag the original keeps on the stack over the window release
// is a local. The register form for register-level callers (the actions in A, the
// chosen flag left in A) lives in tools/register-forms/upkeep-routines.mjs.
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { openWindow } from './window-open.mjs';
import { chooseFromMenu } from './menu-choice.mjs';
import { drawTextBuffer } from './text-draw.mjs';
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
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';

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
const MENU_CALL = [0x809b7d, 0x80a6a5];

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
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

// Choose an action from the menu (80:99EB) for lifted callers, without the JSR frame
// (the caller's return word lies only in free stack bytes): h is the caller's access
// (direct page 0, data bank 80); renderBuffer draws text, accepted are the accepted
// actions and choice receives the chosen flag (0 for none).
export function* chooseAction(h, events, renderBuffer = drawTextBuffer, accepted, choice = {}) {
  const { mem } = h.a,
    { wram } = mem;
  let count = 0;
  choice.action = 0;
  yield () => {
    setWord(wram, DP_ACTION_MENU_MASK, accepted);
    const override = word(wram, ACTION_MENU_OVERRIDE);
    if (override) setWord(wram, DP_ACTION_MENU_MASK, override);
    const y = listActions(wram, word(wram, DP_ACTION_MENU_MASK));
    // No action: the result 0.
    if (y < FIRST_ACTION_END) return;
    count = y >>> 1;
    setWord(wram, ACTION_MENU_NAMES + y, 0);
    setWord(wram, DP_WINDOW_ROWS, count + EXTRA_ROWS);
    setWord(wram, DP_LEFT, WINDOW.left);
    setWord(wram, DP_TOP, WINDOW.top);
    setWord(wram, DP_WINDOW_COLUMNS, WINDOW.columns);
    setWord(wram, DP_WINDOW_ATTRIBUTES, WINDOW.attributes);
    fitListWindow(
      mem,
      mem.language ? listTextIds(mem, (WRAM_BANK << WORD_BITS) | ACTION_MENU_NAMES, count) : [],
    );
  };
  if (!count) return;
  yield* openWindow(h, events);
  yield () => {
    setWord(wram, DP_ACTION_MENU_WINDOW, word(wram, DP_LEFT));
    setWord(wram, DP_TOP, MENU_COLUMN);
    setWord(wram, DP_MENU_ROW, 0);
    setWord(wram, DP_MENU_VISIBLE_ROWS, VISIBLE_ROWS);
    setWord(wram, DP_LIST_TOKENS, ACTION_MENU_NAMES);
    setWord(wram, DP_LIST_TOKEN_BANK, WRAM_BANK);
    setWord(wram, DP_LIST_VALUES, ACTION_MENU_HOTKEYS);
  };
  yield* chooseFromMenu(h, events, renderBuffer, MENU_CALL[1]);
  let chosen;
  yield () => {
    // The chosen row (a cancel counts as Exit) as a table index; the window to release.
    let row = word(wram, DP_LEFT);
    if (row === NONE) row = 0;
    chosen = word(wram, ACTION_MENU_FLAGS + ((row << 1) & WORD_MASK));
    setWord(wram, DP_LEFT, word(wram, DP_ACTION_MENU_WINDOW));
  };
  yield* releaseWindowSequence(h, events);
  yield () => {
    choice.action = chosen;
    setWord(wram, ACTION_MENU_OVERRIDE, 0);
  };
}
// The action menu as the script native 80:9BA0, a sequence: no override, the mask from
// the first argument, the menu and the chosen flag as the result.
export function* chooseScriptActionSequence(h, events, renderBuffer = drawTextBuffer) {
  const { wram } = h.a.mem,
    choice = {};
  yield () => setWord(wram, ACTION_MENU_OVERRIDE, 0);
  yield* chooseAction(h, events, renderBuffer, word(wram, 0), choice);
  yield () => {
    setWord(wram, 0, choice.action);
  };
}
