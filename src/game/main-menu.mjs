// The main menu (lifted from 80:CE6D and the save menu 80:CDD6; register-level versions
// in proof/replay/native-main-menu.mjs, which recorded waits and inputs replay).
//
// The main menu (80:CE6D) opens its window at 0A, 0A with 0C columns and five rows
// (7E:1CED) with the menu 80:CEC3 (Exit, save, karma); the window is released before
// the choice runs, the choice staying on the stack over the release. Save runs
// 80:CDD6, karma 80:EE57 (src/game/karma-menu.mjs); both return to the menu, Exit or a
// cancel ends it.
//
// The save menu (80:CDD6) needs a stopped countdown (7E:1D89 negative); otherwise it
// shows "Cannot save now" in a window at 0A, 0A with 0E columns and six rows until a
// key. With the countdown stopped it lists the save slots after Exit (80:CE65, or the
// port's list with "Save game 3/4" for the four-slot option, two rows more) in the
// main menu's window; a slot n saves slot n - 1 (81:B17D, saveGame of save-slots.mjs)
// and plays sound 36 (80:C46E with FFFF, FF, FF). The window is released.
// Main menu windows and selection compose directly through their original frames.
// Main and save menus also compose their sound and resource refills directly.
//
// Registers (user decision 2026-11-17): both menus work on game state only and leave
// no register values; comparisons check WRAM, video and outputs. None of the callees
// takes a register input. The choice the original keeps on the stack over the window
// release (PEI, PLA) is a local value.
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { openWindow } from './window-open.mjs';
import { releaseWindowSequence } from './window-release.mjs';
import { chooseFromMenuSequence } from './menu-choice.mjs';
import { playSoundEffectCall } from '../apu/sound-effect.mjs';
import { karmaMenu } from './karma-menu.mjs';
import { printText } from './text-print.mjs';
import { waitForConfirmKeySequence } from './confirm-key.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { FOUR_SAVE_SLOTS, ORIGINAL_SAVE_SLOTS, saveGame, saveSlotCount } from './save-slots.mjs';
import {
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  MAIN_MENU_WINDOW,
  TIMER,
} from '../data/wram.mjs';
import {
  PORT_BASE,
  PORT_TEXTS,
  TEXT_EXIT,
  TEXT_SAVE_GAME_1,
  TEXT_SAVE_GAME_2,
} from '../data/port-extension.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const CONFIRM_KEY = 0x80f953,
  PLAIN_MENU = 0x80a6c7;
// The menus' window (0A, 0A, 0C columns; five rows, seven with four slots; three or
// five rows visible) and the menus' item lists.
const MENU_WINDOW = Object.freeze({
    left: 0x0a,
    top: 0x0a,
    columns: 0x0c,
    rows: 5,
    visibleRows: 3,
  }),
  EXTRA_SLOT_ROWS = FOUR_SAVE_SLOTS - ORIGINAL_SAVE_SLOTS,
  MAIN_MENU_ITEMS = 0xcec3,
  SAVE_MENU_ITEMS = 0xce65,
  MENU_COLUMN = 1,
  SAVE_ROW = 1;
// "Cannot save now" and its window.
const TEXT_SAVE_BLOCKED = 0x7058,
  BLOCKED_WINDOW = Object.freeze({ columns: 0x0e, rows: 6 });
// The save sound: 80:C46E with the object FFFF, level and voice FF and sound 36.
const SAVE_SOUND = 0x36;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const negative = (value) => (value & WORD_SIGN) !== 0;
function* returnSequence(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
// A window's place, size and plain attributes, fitted to the texts in
// another language.
function setWindow(h, left, top, columns, rows, ids, options) {
  const { wram } = h.a.mem;
  setWord(wram, DP_WINDOW_LEFT, left);
  setWord(wram, DP_WINDOW_TOP, top);
  setWord(wram, DP_WINDOW_COLUMNS, columns);
  setWord(wram, DP_WINDOW_ROWS, rows);
  setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
  fitListWindow(h.a.mem, ids, options);
}
// The menu's column, first row, visible rows and item list.
function setMenu(h, visibleRows, items, bank) {
  const { wram } = h.a.mem;
  setWord(wram, 2, MENU_COLUMN);
  setWord(wram, DP_MENU_ROW, 0);
  setWord(wram, DP_MENU_VISIBLE_ROWS, visibleRows);
  setWord(wram, DP_LIST_TOKENS, items);
  setWord(wram, DP_LIST_TOKEN_BANK, bank);
}
// The main menu's window released: its number from 1CED.
function* releaseMenuWindow(h, events) {
  const { mem } = h.a;
  yield () => setWord(mem.wram, 0, dataBankWord(mem, MAIN_MENU_WINDOW));
  yield* releaseWindowSequence(h, events);
}

// 80:CDD6: the save menu (see above), for lifted callers without the JSR frame; the
// confirm key and the menu choice keep their own.
export function* saveMenu(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem;
  let stopped;
  yield () => {
    stopped = negative(dataBankWord(mem, TIMER));
    if (stopped) return;
    setWindow(
      h,
      MENU_WINDOW.left,
      MENU_WINDOW.top,
      BLOCKED_WINDOW.columns,
      BLOCKED_WINDOW.rows,
      [TEXT_SAVE_BLOCKED],
      { column: 0 },
    );
  };
  if (!stopped) {
    yield* openWindow(h, events);
    yield () => setWord(wram, 2, TEXT_SAVE_BLOCKED);
    yield* printText(h, events, renderBuffer);
    yield* dialogCallBody(h, 0x80ce5e, CONFIRM_KEY, () => waitForConfirmKeySequence(h, events));
    yield* releaseWindowSequence(h, events);
    return;
  }
  const four = saveSlotCount(h.a) === FOUR_SAVE_SLOTS;
  yield () =>
    setWindow(
      h,
      MENU_WINDOW.left,
      MENU_WINDOW.top,
      MENU_WINDOW.columns,
      MENU_WINDOW.rows + (four ? EXTRA_SLOT_ROWS : 0),
      [
        TEXT_EXIT,
        TEXT_SAVE_GAME_1,
        TEXT_SAVE_GAME_2,
        ...(four ? PORT_TEXTS.map(({ id }) => id) : []),
      ],
    );
  yield* openWindow(h, events);
  yield () => {
    setDataBankWord(mem, MAIN_MENU_WINDOW, 0, word(wram, 0));
    if (four)
      setMenu(
        h,
        MENU_WINDOW.visibleRows + EXTRA_SLOT_ROWS,
        PORT_BASE & WORD_MASK,
        PORT_BASE >>> WORD_BITS,
      );
    else setMenu(h, MENU_WINDOW.visibleRows, SAVE_MENU_ITEMS, CODE_BANK);
  };
  yield* dialogCallBody(h, 0x80ce0f, PLAIN_MENU, () =>
    chooseFromMenuSequence(h, events, renderBuffer, PLAIN_MENU),
  );
  let slot;
  yield () => {
    slot = word(wram, 0);
    if (!slot || negative(slot)) return;
    // Slot n saves slot n - 1 (81:B17D).
    saveGame(mem, slot - 1, saveSlotCount(h.a) === FOUR_SAVE_SLOTS);
    setWord(wram, 0, WORD_MASK);
    setWord(wram, DP_SOUND_LEVEL, BYTE_MASK);
    setWord(wram, DP_SOUND_VOICE, BYTE_MASK);
    setWord(wram, 2, SAVE_SOUND);
  };
  if (slot && !negative(slot)) yield* segmentSequence(() => playSoundEffectCall(h));
  yield* releaseMenuWindow(h, events);
}
// The save menu as called with JSR (80:CDD6); returns with its RTS.
export function* saveMenuSequence(h, events, renderBuffer = drawTextBufferSequence) {
  yield* saveMenu(h, events, renderBuffer);
  return yield* returnSequence(h);
}

// 80:CE6D: the main menu (see above). A sequence that ends with its RTS.
export function* mainMenuSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem,
    ids = mem.language
      ? listTextIds(mem, CODE_BANK_BASE | MAIN_MENU_ITEMS, MENU_WINDOW.visibleRows)
      : [];
  for (;;) {
    yield () =>
      setWindow(h, MENU_WINDOW.left, MENU_WINDOW.top, MENU_WINDOW.columns, MENU_WINDOW.rows, ids);
    yield* openWindow(h, events);
    yield () => {
      setDataBankWord(mem, MAIN_MENU_WINDOW, 0, word(wram, 0));
      setMenu(h, MENU_WINDOW.visibleRows, MAIN_MENU_ITEMS, CODE_BANK);
    };
    yield* dialogCallBody(h, 0x80cea1, PLAIN_MENU, () =>
      chooseFromMenuSequence(h, events, renderBuffer, PLAIN_MENU),
    );
    // The choice is kept over the window's release (PEI, PLA in the original).
    let chosen;
    yield () => {
      chosen = word(wram, 0);
    };
    yield* releaseMenuWindow(h, events);
    if (!chosen || negative(chosen)) break;
    if (chosen === SAVE_ROW) yield* saveMenu(h, events, renderBuffer);
    else yield* karmaMenu(h, events, renderBuffer);
  }
  return yield* returnSequence(h);
}
