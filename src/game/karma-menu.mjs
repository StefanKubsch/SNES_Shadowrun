// The karma menu of the main menu (lifted from 80:EE57, 80:EF82, 80:F006 and the lists
// 80:F054, 80:F0F3 and 80:F1B5; register-level versions in proof/replay/native-main-menu.mjs,
// which recorded waits and inputs replay).
//
// The menu (80:EE57) releases the notice windows and puts the glove away, points DP F9
// at Jake's record, opens the balance window (03, 05, 0B by 03; 7E:1F4C) with the karma
// line and the category window (03, 08, 0B by 06; 1F4E) with the menu 80:EF78. A
// category opens the header and list windows (0E, 05 and 0E, 08, 10 columns; 1F50 and
// 1F52) for its list and releases them after it; Exit or a cancel (FFFF) releases the
// menu's windows and tops up the leader's state count and magic points (80:CECB and
// 80:CF2E with FF).
//
// The karma line (80:EF82) redraws the balance window (80:FA67 on 7E:1F4C) with
// "Karma" at its first row and the karma 7E:3C11 divided by eight (also kept in DP 17)
// at column 6.
//
// A step bought (80:F006) costs eight times the value byte at the long pointer DP 0E
// (bank DP 10; the cost goes to DP 11). Enough karma pays for it and raises the byte by
// one; too little shows "Not enough karma" in a window at 0E, 02 with 10 columns and
// three rows until a key, and clears DP 0E (no step bought).
//
// A list (KARMA_LISTS: its header text, value pointers into bank 7E, names, limits and
// length) prints its header, then lists after Exit the values that are not zero and
// below their limit: name, value and the value's index (7E:1DAB, 1EB1, 1E2F). A changed
// row count puts the menu's cursor DP 1A back on Exit. The redrawn list window (1F52)
// takes a numbered menu (80:A6B8 from row DP 1A); a row buys a step of its value and
// shows the karma again, Exit or a cancel ends. Jake's Body list (80:F0F3) also raises
// his count maximum 7E:3C00 by ten for a Body step and the leader's state count by ten
// (80:CECB). The callees (window 80:F963, redraw 80:FA67, cursor 80:FAAC, text
// 80:FE69, number 80:FD80, key wait 80:F953, release 80:FA3E, numbered menu 80:A6B8,
// state count 80:CECB and the line and purchase above) compose through their original
// frames. State count and magic refill also compose directly.
//
// Registers (user decision 2026-11-17): the menu works on game state only and leaves
// no register values; comparisons check WRAM, video and outputs. The numbered menu
// 80:A6B8 takes its preselected row as a parameter. The category row the original keeps on
// the stack over the detail windows (PHA, PLA) is a local value.
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { chooseFromMenuSequence } from './menu-choice.mjs';
import { openWindow, requestTileClear } from './window-open.mjs';
import { setTextCursor, printNumber } from './window-text.mjs';
import { printText } from './text-print.mjs';
import {
  releaseNoticeWindowsCallSequence,
  putGloveAwayCallSequence,
  releaseWindowSequence,
} from './window-release.mjs';
import { waitForConfirmKeySequence } from './confirm-key.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { raiseStateCountSequence } from './runner-state-call.mjs';
import { raiseMemberMagicPoints } from '../script/native-magic-points-raise.mjs';
import { KARMA_LISTS, KARMA_WINDOWS } from '../system/native-main-menu.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import {
  DP_CURSOR_ROW,
  DP_KARMA_PREVIOUS_ROW_BYTES,
  DP_KARMA_ROW_BYTES,
  DP_KARMA_SELECTION,
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_LIST_VALUES,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  JAKE_BODY,
  JAKE_COUNT_MAX,
  KARMA_LIST_WINDOW,
  KARMA_MENU_INDICES,
  KARMA_MENU_NAMES,
  KARMA_MENU_VALUES,
  KARMA_ROW_INDICES,
  KARMA_ROW_NAMES,
  KARMA_ROW_VALUES,
  PLAYER_OBJECT,
  DP_KARMA_DISPLAY,
  DP_KARMA_UPGRADE_COST,
  DP_KARMA_VALUE_BANK,
  DP_KARMA_VALUE_POINTER,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  KARMA,
  KARMA_BALANCE_WINDOW,
  KARMA_CATEGORY_WINDOW,
  KARMA_HEADER_WINDOW,
  DP_WEAPON_RECORD,
  DP_WEAPON_RECORD_BANK,
  WRAM,
} from '../data/wram.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { RUNNER_RECORD_BANKS, RUNNER_RECORD_POINTERS } from '../data/runners.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { CODE_BANK, CODE_BANK_BASE, WRAM_BANK } from '../constants/memory-map.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

const CONFIRM_KEY = 0x80f953,
  NUMBERED_MENU = 0x80a6b8,
  RAISE_STATE_COUNT = 0x80cecb,
  KARMA_LINE = 0x80ef82,
  BUY_STEP = 0x80f006,
  RELEASE_NOTICES = 0x80ff79,
  PUT_GLOVE_AWAY = 0x80bcb2,
  PLAIN_MENU = 0x80a6c7,
  RAISE_MAGIC_POINTS = 0x80cf2e;
// The karma menu's categories (80:EF78) and their lists: row 1 Body (80:F0F3), row 2
// the first list (80:F054), any other the third (80:F1B5); the detail windows leave
// three columns for the values.
const KARMA_MENU_ITEMS = 0xef78,
  BODY_ROW = 1,
  FIRST_LIST_ROW = 2,
  KARMA_LIST_BODY = 0x80f0f3,
  KARMA_LIST_FIRST = 0x80f054,
  KARMA_LIST_THIRD = 0x80f1b5,
  KARMA_VALUE_COLUMNS = 3;
// The list menu's first column; a Body step raises the count maximum and the leader's
// state count by ten.
const MENU_COLUMN = 1,
  BODY_COUNT_INCREMENT = 10;
// "Karma" and its number's column; the karma is shown divided by eight, a step
// costs eight times its value.
const TEXT_KARMA = 0x7117,
  KARMA_NUMBER_COLUMN = 6,
  KARMA_SHIFT = 3,
  COST_SHIFT = 3;
// The notice for too little karma and its window.
const TEXT_KARMA_INSUFFICIENT = 0x711b,
  NOTICE_WINDOW = Object.freeze({ left: 0x0e, top: 2, columns: 0x10, rows: 3 });

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
function* returnSequence(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
// The long pointer DP 0E with its bank DP 10.
const valueAddress = (wram) =>
  (word(wram, DP_KARMA_VALUE_POINTER) | (wram[DP_KARMA_VALUE_BANK] << WORD_BITS)) & LONG_MASK;

// 80:EF82: the karma line (see above). A sequence that ends with its RTS.
export function* karmaLineSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem;
  yield () => setWord(wram, 0, dataBankWord(mem, KARMA_BALANCE_WINDOW));
  yield* requestTileClear(h, events);
  yield () => {
    setWord(wram, 2, 0);
    setWord(wram, DP_CURSOR_ROW, 0);
  };
  yield* segmentSequence(() => setTextCursor(h));
  yield () => setWord(wram, 2, TEXT_KARMA);
  yield* printText(h, events, renderBuffer);
  yield () => {
    setWord(wram, 2, KARMA_NUMBER_COLUMN);
    setWord(wram, DP_CURSOR_ROW, 0);
  };
  yield* segmentSequence(() => setTextCursor(h));
  yield () => {
    const shown = mem.read16(WRAM + KARMA) >>> KARMA_SHIFT;
    setWord(wram, DP_KARMA_DISPLAY, shown);
    setWord(wram, 2, shown);
  };
  yield* printNumber(h, events, renderBuffer);
  return yield* returnSequence(h);
}

// 80:F006: one step bought (see above). A sequence that ends with its RTS.
export function* buyStepSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem;
  let paid;
  yield () => {
    const cost = (mem.read16(valueAddress(wram)) & BYTE_MASK) << COST_SHIFT;
    setWord(wram, DP_KARMA_UPGRADE_COST, cost);
    const karma = mem.read16(WRAM + KARMA);
    paid = karma >= cost;
    if (!paid) {
      setWord(wram, DP_WINDOW_LEFT, NOTICE_WINDOW.left);
      setWord(wram, DP_WINDOW_TOP, NOTICE_WINDOW.top);
      setWord(wram, DP_WINDOW_COLUMNS, NOTICE_WINDOW.columns);
      setWord(wram, DP_WINDOW_ROWS, NOTICE_WINDOW.rows);
      setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
      fitListWindow(mem, [TEXT_KARMA_INSUFFICIENT], { column: 0 });
      return;
    }
    mem.write16(WRAM + KARMA, karma - cost);
    // The value is a byte.
    const address = valueAddress(wram);
    mem.write8(address, (mem.read8(address) + 1) & BYTE_MASK);
  };
  if (paid) return yield* returnSequence(h);
  yield* openWindow(h, events);
  yield () => setWord(wram, 2, TEXT_KARMA_INSUFFICIENT);
  yield* printText(h, events, renderBuffer);
  yield* dialogCallBody(h, 0x80f03d, CONFIRM_KEY, () => waitForConfirmKeySequence(h, events));
  yield* releaseWindowSequence(h, events);
  yield () => setWord(wram, DP_KARMA_VALUE_POINTER, 0);
  return yield* returnSequence(h);
}

const negative = (value) => (value & WORD_SIGN) !== 0;

// 80:F054, 80:F0F3 or 80:F1B5: a karma list (see above). A sequence that ends with its
// RTS.
export function* karmaListSequence(h, events, entry, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem,
    list = KARMA_LISTS[entry];
  const menuHeader = () => {
    setDataBankWord(mem, KARMA_MENU_NAMES, 0, TEXT_EXIT);
    setDataBankWord(mem, KARMA_MENU_VALUES, 0, 0);
  };
  yield () => setWord(wram, 2, list.text);
  yield* printText(h, events, renderBuffer);
  yield () => {
    setWord(wram, DP_KARMA_VALUE_BANK, WRAM_BANK);
    // The first list builds Exit again in every round.
    if (!list.header) menuHeader();
    setWord(wram, DP_KARMA_PREVIOUS_ROW_BYTES, WORD_MASK);
  };
  for (;;) {
    yield () => {
      if (list.header) menuHeader();
      setWord(wram, DP_KARMA_ROW_BYTES, 0);
      for (let index = 0; index < list.end; index += 2) {
        setWord(wram, DP_KARMA_VALUE_POINTER, dataBankWord(mem, list.pointers, index));
        const value = mem.read16(valueAddress(wram)) & BYTE_MASK;
        if (!value || value >= dataBankWord(mem, list.limits, index)) continue;
        const row = word(wram, DP_KARMA_ROW_BYTES);
        setDataBankWord(mem, KARMA_ROW_NAMES, row, dataBankWord(mem, list.names, index));
        setDataBankWord(mem, KARMA_ROW_VALUES, row, value);
        setDataBankWord(mem, KARMA_ROW_INDICES, row, index);
        setWord(wram, DP_KARMA_ROW_BYTES, row + 2);
      }
      const rows = word(wram, DP_KARMA_ROW_BYTES),
        previous = word(wram, DP_KARMA_PREVIOUS_ROW_BYTES);
      setDataBankWord(mem, KARMA_ROW_NAMES, rows, 0);
      if (rows !== previous) {
        setWord(wram, DP_KARMA_PREVIOUS_ROW_BYTES, rows);
        setWord(wram, DP_KARMA_SELECTION, 0);
      }
      setWord(wram, 0, dataBankWord(mem, KARMA_LIST_WINDOW));
    };
    yield* requestTileClear(h, events);
    yield () => {
      setWord(wram, 2, MENU_COLUMN);
      setWord(wram, DP_MENU_ROW, 0);
      setWord(wram, DP_MENU_VISIBLE_ROWS, KARMA_WINDOWS.listVisibleRows);
      setWord(wram, DP_LIST_TOKENS, KARMA_MENU_NAMES);
      setWord(wram, DP_LIST_TOKEN_BANK, WRAM_BANK);
      setWord(wram, DP_LIST_VALUES, KARMA_MENU_VALUES);
    };
    yield* dialogCallBody(h, list.pcs.menu, NUMBERED_MENU, () =>
      chooseFromMenuSequence(
        h,
        events,
        renderBuffer,
        NUMBERED_MENU,
        word(wram, DP_KARMA_SELECTION),
      ),
    );
    let chosen;
    yield () => {
      chosen = word(wram, 0);
    };
    if (!chosen || negative(chosen)) return yield* returnSequence(h);
    yield () => {
      setWord(wram, DP_KARMA_SELECTION, chosen);
      const index = dataBankWord(mem, KARMA_MENU_INDICES, chosen << 1),
        pointer = dataBankWord(mem, list.pointers, index);
      setWord(wram, DP_KARMA_VALUE_POINTER, pointer);
    };
    yield* dialogCallBody(h, list.pcs.buy, BUY_STEP, () =>
      buyStepSequence(h, events, renderBuffer),
    );
    if (list.body) {
      let body;
      yield () => {
        body = word(wram, DP_KARMA_VALUE_POINTER) === JAKE_BODY;
        if (!body) return;
        // The count maximum is a byte.
        wram[JAKE_COUNT_MAX] = (wram[JAKE_COUNT_MAX] + BODY_COUNT_INCREMENT) & BYTE_MASK;
        setWord(wram, 0, dataBankWord(mem, PLAYER_OBJECT));
        setWord(wram, 2, BODY_COUNT_INCREMENT);
      };
      if (body)
        yield* dialogCallBody(h, list.pcs.refill, RAISE_STATE_COUNT, () =>
          raiseStateCountSequence(h, events),
        );
    }
    yield* dialogCallBody(h, list.pcs.karma, KARMA_LINE, () =>
      karmaLineSequence(h, events, renderBuffer),
    );
  }
}

// 80:EE57: the karma menu (see above). A sequence that ends with its RTS.
export function* karmaMenuSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem,
    { language } = mem;
  // A window opened and its number kept; a kept window released.
  const openKept = function* ([left, top, columns, rows], keep, ids = [], options) {
    yield () => {
      setWord(wram, DP_WINDOW_LEFT, left);
      setWord(wram, DP_WINDOW_TOP, top);
      setWord(wram, DP_WINDOW_COLUMNS, columns);
      setWord(wram, DP_WINDOW_ROWS, rows);
      setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
      fitListWindow(mem, ids, options);
    };
    yield* openWindow(h, events);
    yield () => setDataBankWord(mem, keep, 0, word(wram, 0));
  };
  const release = function* (keep) {
    yield () => setWord(wram, 0, dataBankWord(mem, keep));
    yield* releaseWindowSequence(h, events);
  };
  yield* dialogCallBody(h, 0x80ee57, RELEASE_NOTICES, () =>
    releaseNoticeWindowsCallSequence(h, events),
  );
  yield* dialogCallBody(h, 0x80ee5a, PUT_GLOVE_AWAY, () => putGloveAwayCallSequence(h, events));
  yield () => {
    // Jake's record (the first runner's) at DP F9.
    setWord(wram, DP_WEAPON_RECORD, dataBankWord(mem, RUNNER_RECORD_POINTERS));
    wram[DP_WEAPON_RECORD_BANK] = mem.read8(CODE_BANK_BASE + RUNNER_RECORD_BANKS);
  };
  yield* openKept(
    [
      KARMA_WINDOWS.left,
      KARMA_WINDOWS.balanceTop,
      KARMA_WINDOWS.columns,
      KARMA_WINDOWS.balanceRows,
    ],
    KARMA_BALANCE_WINDOW,
  );
  yield* openKept(
    [
      KARMA_WINDOWS.left,
      KARMA_WINDOWS.categoryTop,
      KARMA_WINDOWS.columns,
      KARMA_WINDOWS.categoryRows,
    ],
    KARMA_CATEGORY_WINDOW,
    language
      ? listTextIds(mem, CODE_BANK_BASE | KARMA_MENU_ITEMS, KARMA_WINDOWS.categoryVisibleRows)
      : [],
  );
  yield* dialogCallBody(h, 0x80eead, KARMA_LINE, () => karmaLineSequence(h, events, renderBuffer));
  // Translated category and upgrade labels cannot both fit across thirty tiles: the
  // detail windows go below the categories instead of beside them.
  const detailTop = language
      ? KARMA_WINDOWS.categoryTop + KARMA_WINDOWS.categoryRows + 1
      : KARMA_WINDOWS.headerTop,
    detailIds = language
      ? [
          TEXT_EXIT,
          ...Object.values(KARMA_LISTS).flatMap((list) => [
            list.text,
            ...listTextIds(mem, CODE_BANK_BASE | list.names, list.end / 2),
          ]),
        ]
      : [];
  for (;;) {
    yield () => setWord(wram, 0, dataBankWord(mem, KARMA_CATEGORY_WINDOW));
    yield* requestTileClear(h, events);
    yield () => {
      setWord(wram, 2, MENU_COLUMN);
      setWord(wram, DP_MENU_ROW, 0);
      setWord(wram, DP_MENU_VISIBLE_ROWS, KARMA_WINDOWS.categoryVisibleRows);
      setWord(wram, DP_LIST_TOKENS, KARMA_MENU_ITEMS);
      setWord(wram, DP_LIST_TOKEN_BANK, CODE_BANK);
    };
    yield* dialogCallBody(h, 0x80eece, PLAIN_MENU, () =>
      chooseFromMenuSequence(h, events, renderBuffer, PLAIN_MENU),
    );
    let chosen;
    yield () => {
      chosen = word(wram, 0);
    };
    if (!chosen || chosen === WORD_MASK) break;
    const options = { valueColumns: KARMA_VALUE_COLUMNS };
    yield* openKept(
      [KARMA_WINDOWS.detailLeft, detailTop, KARMA_WINDOWS.detailColumns, KARMA_WINDOWS.headerRows],
      KARMA_HEADER_WINDOW,
      detailIds,
      options,
    );
    yield* openKept(
      [
        KARMA_WINDOWS.detailLeft,
        language ? detailTop + KARMA_WINDOWS.headerRows : KARMA_WINDOWS.listTop,
        KARMA_WINDOWS.detailColumns,
        KARMA_WINDOWS.listRows,
      ],
      KARMA_LIST_WINDOW,
      detailIds,
      options,
    );
    // Row 1 is the Body list, row 2 the first list, any other the third.
    const [pc, entry] =
      chosen === BODY_ROW
        ? [0x80ef28, KARMA_LIST_BODY]
        : chosen === FIRST_LIST_ROW
          ? [0x80ef32, KARMA_LIST_FIRST]
          : [0x80ef37, KARMA_LIST_THIRD];
    yield () => setWord(wram, 0, dataBankWord(mem, KARMA_HEADER_WINDOW));
    yield* dialogCallBody(h, pc, entry, () => karmaListSequence(h, events, entry, renderBuffer));
    yield* release(KARMA_LIST_WINDOW);
    yield* release(KARMA_HEADER_WINDOW);
  }
  yield* release(KARMA_CATEGORY_WINDOW);
  yield* release(KARMA_BALANCE_WINDOW);
  // The leader's state count and magic points topped up (FF: as far as they go).
  for (const [pc, target] of [
    [0x80ef67, RAISE_STATE_COUNT],
    [0x80ef74, RAISE_MAGIC_POINTS],
  ]) {
    yield () => {
      setWord(wram, 0, dataBankWord(mem, PLAYER_OBJECT));
      setWord(wram, 2, BYTE_MASK);
    };
    if (target === RAISE_MAGIC_POINTS)
      yield* dialogCallBody(h, pc, target, () =>
        segmentSequence(() => raiseMemberMagicPoints(h.a, false)),
      );
    else yield* dialogCallBody(h, pc, target, () => raiseStateCountSequence(h, events));
  }
  return yield* returnSequence(h);
}
