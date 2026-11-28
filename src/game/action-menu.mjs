// Offer accepted actions in menu order, with shared rows and a named selection.
// Flag row seven retains its override alias, including writes while building rows.
import { actionMenuState } from '../state/action-menu.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { openWindow } from './window-open.mjs';
import { chooseFromMenu, MENU_WITH_HOTKEYS } from './menu-choice.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { releaseWindowSequence } from './window-release.mjs';
import { WORD_MASK } from '../constants/bits.mjs';

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
  NONE = WORD_MASK,
  // CPY #3: at least one action after Exit (the index counts in words).
  FIRST_ACTION_END = 3;

// Fill the menu's tables from the accepted actions; returns the table index past the
// last action.
function listActions(state, accepted) {
  let y = 0;
  const append = ([action, text, hotkey]) => {
    const row = state.row(y / 2);
    row.text = text;
    row.flag = action;
    row.hotkey = hotkey;
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

export function* chooseAction(h, events, renderBuffer = drawTextBuffer, accepted, choice = {}) {
  const state = actionMenuState(h.a.mem);
  let count = 0;
  choice.action = 0;
  yield () => {
    state.accepted = accepted;
    const override = state.override;
    if (override) state.accepted = override;
    const y = listActions(state, state.accepted);
    // No action: the result 0.
    if (y < FIRST_ACTION_END) return;
    count = y >>> 1;
    state.row(y / 2).text = 0;
    state.windows.opening.rows = count + EXTRA_ROWS;
    state.windows.windowArgument = WINDOW.left;
    state.windows.valueArgument = WINDOW.top;
    state.windows.opening.columns = WINDOW.columns;
    state.windows.opening.attributes = WINDOW.attributes;
    state.fitWindow(count);
  };
  if (!count) return;
  yield* openWindow(h, events);
  yield () => {
    state.window = state.windows.windowArgument;
    state.configureChoice(h.a, MENU_COLUMN, VISIBLE_ROWS);
  };
  yield* chooseFromMenu(h, events, renderBuffer, MENU_WITH_HOTKEYS);
  let chosen;
  yield () => {
    // The chosen row (a cancel counts as Exit) as a table index; the window to release.
    let row = state.windows.windowArgument;
    if (row === NONE) row = 0;
    chosen = state.row(row).flag;
    state.windows.windowArgument = state.window;
  };
  yield* releaseWindowSequence(h, events);
  yield () => {
    choice.action = chosen;
    state.override = 0;
  };
}
// The action menu as the script native 80:9BA0, a sequence: no override, the mask from
// the first argument, the menu and the chosen flag as the result.
export function* chooseScriptActionSequence(h, events, renderBuffer = drawTextBuffer) {
  const state = actionMenuState(h.a.mem),
    choice = {};
  yield () => (state.override = 0);
  yield* chooseAction(h, events, renderBuffer, state.windows.windowArgument, choice);
  yield () => {
    state.windows.windowArgument = choice.action;
  };
}
