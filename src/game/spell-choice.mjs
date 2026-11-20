import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The spell choice (lifted from the script native 80:E1CF; register-level version in
// proof/replay/native-spell-choice.mjs, which recorded waits and inputs replay).
//
// With learned spells (the word list 7E:3C1C, 0 ends it) a window opens (80:F963 at
// 0E, 05, 10 x 07; its number kept in DP 0E) with a menu (80:A6C7) of Exit and the
// spells' names (text numbers 80:D9B8 by spell, listed at 1D75 after the header 1D73),
// five rows visible. A chosen row past Exit gives its spell, otherwise 0. In every case
// the window DP 0E is released (80:FA3E; without spells the original releases the unset
// DP 0E) and the result goes to DP 00. The callees compose directly through their original
// frames, each with its own callees.
//
// Registers (user decision 2026-11-17): game state only. No callee takes a register
// input (the plain menu 80:A6C7 has none) and no register values are left; the result
// the original keeps on the stack over the window release is a local.
import { dialogCallBody } from '../system/native-call-continuation.mjs';
import { openWindow } from './window-open.mjs';
import { releaseWindowSequence } from './window-release.mjs';
import { chooseFromMenuSequence } from './menu-choice.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { taskStop } from '../system/task-stop.mjs';
import { DP_SPELL_WINDOW, LIST_ENTRY_LIMIT, SPELL_WINDOW } from '../data/native-spell-choice.mjs';
import { TEXT_NUMBERS } from '../data/native-notice.mjs';
import {
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_MENU_COLUMN,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  SPELL_CHOICE_HEADER,
  SPELL_CHOICE_NAMES,
  SPELL_LIST,
} from '../data/wram.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../constants/bits.mjs';
import { CODE_BANK_BASE, WRAM_BANK } from '../constants/memory-map.mjs';

// The callees and their call sites.
const MENU = [0x80e229, 0x80a6c7];
// The menu's first column and its cancel word, and the result without a spell.
const MENU_COLUMN = 1,
  CANCELLED = WORD_MASK,
  NO_SPELL = 0;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};

// The menu list: each learned spell's name text (in the order of the list) after Exit.
// The original has no bound; the port stops after 8000 spells.
function listSpellNames(mem) {
  let x = 0;
  for (let n = 0; ; n++) {
    if (n === LIST_ENTRY_LIMIT) taskStop('task_native_e1cf_list_unbounded');
    const spell = word(mem.wram, SPELL_LIST + x);
    if (spell === 0) break;
    const name = dataBankWord(mem, TEXT_NUMBERS, (spell << 1) & WORD_MASK);
    setDataBankWord(mem, SPELL_CHOICE_NAMES, x, name);
    x = (x + 2) & WORD_MASK;
  }
  setDataBankWord(mem, SPELL_CHOICE_NAMES, x, 0);
  setDataBankWord(mem, SPELL_CHOICE_HEADER, 0, TEXT_EXIT);
}

// The spell of the chosen menu row (the row's list word before it), or null for Exit
// or a cancel.
function chosenSpell(wram, row) {
  if (row === CANCELLED) return null;
  const doubled = (row << 1) & WORD_MASK;
  // Exit (row 0) doubles to 0, and so does 8000.
  if (doubled === 0) return null;
  return word(wram, SPELL_LIST + ((doubled - 2) & WORD_MASK));
}

// 80:E1CF: choose one of the learned spells; DP 00 gets it or 0. A sequence that ends
// with the native's RTS.
export function* chooseSpellSequence(h, events, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem;
  let spells,
    spell = null;
  yield () => {
    spells = word(wram, SPELL_LIST) !== 0;
    if (!spells) return;
    for (const [offset, value] of [
      [DP_WINDOW_LEFT, SPELL_WINDOW.left],
      [DP_WINDOW_TOP, SPELL_WINDOW.top],
      [DP_WINDOW_COLUMNS, SPELL_WINDOW.columns],
      [DP_WINDOW_ROWS, SPELL_WINDOW.rows],
      [DP_WINDOW_ATTRIBUTES, 0],
    ])
      setWord(wram, offset, value);
    // Another language fits the window to the names before it opens.
    if (mem.language) {
      const ids = listTextIds(mem, (WRAM_BANK << WORD_BITS) + SPELL_LIST, LIST_ENTRY_LIMIT).map(
        (number) => mem.read16(CODE_BANK_BASE | (TEXT_NUMBERS + 2 * number)),
      );
      fitListWindow(mem, [TEXT_EXIT, ...ids]);
    }
  };
  if (spells) {
    yield* openWindow(h, events);
    yield () => {
      setWord(wram, DP_SPELL_WINDOW, word(wram, 0));
      listSpellNames(mem);
      setWord(wram, DP_MENU_COLUMN, MENU_COLUMN);
      setWord(wram, DP_MENU_ROW, 0);
      setWord(wram, DP_MENU_VISIBLE_ROWS, SPELL_WINDOW.visibleRows);
      setWord(wram, DP_LIST_TOKENS, SPELL_CHOICE_HEADER);
      setWord(wram, DP_LIST_TOKEN_BANK, WRAM_BANK);
    };
    yield* dialogCallBody(h, ...MENU, () =>
      chooseFromMenuSequence(h, events, renderBuffer, MENU[1]),
    );
    yield () => {
      spell = chosenSpell(wram, word(wram, 0));
    };
  }
  // The result is kept over the window's release (on the stack in the original).
  yield () => setWord(wram, 0, word(wram, DP_SPELL_WINDOW));
  yield* releaseWindowSequence(h, events);
  let result;
  yield () => {
    setWord(wram, 0, spell ?? NO_SPELL);
    result = h.rts();
  };
  return result;
}
