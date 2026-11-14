// The main menu (lifted from 80:CE6D and the save menu 80:CDD6; register-level versions
// in src/task/native-main-menu.mjs, which recorded waits and inputs replay).
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
// The callees run through their frames from the routine table.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
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
} from '../task/wram.mjs';
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
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

const OPEN_WINDOW = 0x80f963,
  TEXT = 0x80fe69,
  CONFIRM_KEY = 0x80f953,
  RELEASE_WINDOW = 0x80fa3e,
  PLAIN_MENU = 0x80a6c7,
  SOUND_EFFECT = 0x80c46e,
  SAVE_MENU = 0x80cdd6,
  KARMA_MENU = 0x80ee57;
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
const setFlag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const load = (ctx, value) => {
  ctx.a = value;
  setFlag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  setFlag(ctx, FLAG_ZERO, value === 0);
};
const negative = (value) => (value & WORD_SIGN) !== 0;
const call = (h, events, routines, pc, target) =>
  nativeCallSequence(h, events, routines, pc, target, false, false);
function* returnSequence(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
// A window's place, size and plain attributes (A left 0), fitted to the texts in
// another language.
function setWindow(h, left, top, columns, rows, ids, options) {
  const { wram } = h.a.mem;
  setWord(wram, DP_WINDOW_LEFT, left);
  setWord(wram, DP_WINDOW_TOP, top);
  setWord(wram, DP_WINDOW_COLUMNS, columns);
  setWord(wram, DP_WINDOW_ROWS, rows);
  setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
  load(h.ctx, 0);
  fitListWindow(h.a.mem, h, ids, options);
}
// The menu's column, first row, visible rows and item list (A left the list's bank).
function setMenu(h, visibleRows, items, bank) {
  const { wram } = h.a.mem;
  setWord(wram, 2, MENU_COLUMN);
  setWord(wram, DP_MENU_ROW, 0);
  setWord(wram, DP_MENU_VISIBLE_ROWS, visibleRows);
  setWord(wram, DP_LIST_TOKENS, items);
  setWord(wram, DP_LIST_TOKEN_BANK, bank);
  load(h.ctx, bank);
}
// The main menu's window released: its number from 1CED.
function* releaseMenuWindow(h, events, routines, pc) {
  const { mem } = h.a;
  yield () => {
    const window = dataBankWord(mem, MAIN_MENU_WINDOW);
    load(h.ctx, window);
    setWord(mem.wram, 0, window);
  };
  yield* call(h, events, routines, pc, RELEASE_WINDOW);
}

// 80:CDD6: the save menu (see above). A sequence that ends with its RTS.
export function* saveMenuSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  let stopped;
  yield () => {
    const timer = dataBankWord(mem, TIMER);
    load(ctx, timer);
    stopped = negative(timer);
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
    yield* call(h, events, routines, 0x80ce53, OPEN_WINDOW);
    yield () => {
      load(ctx, TEXT_SAVE_BLOCKED);
      setWord(wram, 2, TEXT_SAVE_BLOCKED);
    };
    yield* call(h, events, routines, 0x80ce5b, TEXT);
    yield* call(h, events, routines, 0x80ce5e, CONFIRM_KEY);
    yield* call(h, events, routines, 0x80ce61, RELEASE_WINDOW);
    return yield* returnSequence(h);
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
  yield* call(h, events, routines, 0x80cdf1, OPEN_WINDOW);
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
  yield* call(h, events, routines, 0x80ce0f, PLAIN_MENU);
  let slot;
  yield () => {
    slot = word(wram, 0);
    load(ctx, slot);
    if (!slot || negative(slot)) return;
    // Slot n saves slot n - 1 (81:B17D).
    saveGame(mem, slot - 1, saveSlotCount(h.a) === FOUR_SAVE_SLOTS);
    setWord(wram, 0, WORD_MASK);
    setWord(wram, DP_SOUND_LEVEL, BYTE_MASK);
    setWord(wram, DP_SOUND_VOICE, BYTE_MASK);
    load(ctx, SAVE_SOUND);
    setWord(wram, 2, SAVE_SOUND);
  };
  if (slot && !negative(slot)) yield* call(h, events, routines, 0x80ce31, SOUND_EFFECT);
  yield* releaseMenuWindow(h, events, routines, 0x80ce39);
  return yield* returnSequence(h);
}

// 80:CE6D: the main menu (see above). A sequence that ends with its RTS.
export function* mainMenuSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    ids = mem.language
      ? listTextIds(mem, CODE_BANK_BASE | MAIN_MENU_ITEMS, MENU_WINDOW.visibleRows)
      : [];
  for (;;) {
    yield () =>
      setWindow(h, MENU_WINDOW.left, MENU_WINDOW.top, MENU_WINDOW.columns, MENU_WINDOW.rows, ids);
    yield* call(h, events, routines, 0x80ce83, OPEN_WINDOW);
    yield () => {
      setDataBankWord(mem, MAIN_MENU_WINDOW, 0, word(wram, 0));
      setMenu(h, MENU_WINDOW.visibleRows, MAIN_MENU_ITEMS, CODE_BANK);
    };
    yield* call(h, events, routines, 0x80cea1, PLAIN_MENU);
    // The choice stays on the stack over the window's release (PEI, PLA).
    yield () => h.push(word(wram, 0), 2);
    yield* releaseMenuWindow(h, events, routines, 0x80ceab);
    let chosen;
    yield () => {
      chosen = h.pull(2);
      load(ctx, chosen);
      if (!chosen || negative(chosen)) return;
      // CMP #1 on a positive row: carry set, sign clear, zero for save.
      setFlag(ctx, FLAG_CARRY, true);
      setFlag(ctx, FLAG_NEGATIVE, false);
      setFlag(ctx, FLAG_ZERO, chosen === SAVE_ROW);
    };
    if (!chosen || negative(chosen)) break;
    if (chosen === SAVE_ROW) yield* call(h, events, routines, 0x80ceb8, SAVE_MENU);
    else yield* call(h, events, routines, 0x80cebd, KARMA_MENU);
  }
  return yield* returnSequence(h);
}
