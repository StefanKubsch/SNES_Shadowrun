// The spell choice (lifted from the script native 80:E1CF; register-level version in
// src/task/native-spell-choice.mjs, which recorded waits and inputs replay).
//
// With learned spells (the word list 7E:3C1C, 0 ends it) a window opens (80:F963 at
// 0E, 05, 10 x 07; its number kept in DP 0E) with a menu (80:A6C7) of Exit and the
// spells' names (text numbers 80:D9B8 by spell, listed at 1D75 after the header 1D73),
// five rows visible. A chosen row past Exit gives its spell, otherwise 0. In every case
// the window DP 0E is released (80:FA3E; without spells the original releases the unset
// DP 0E) and the result goes to DP 00. The callees run through their frames from the
// routine table, each with its own callees.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { taskStop } from '../task/plan.mjs';
import { DP_SPELL_WINDOW, LIST_ENTRY_LIMIT, SPELL_WINDOW } from '../task/native-spell-choice.mjs';
import { TEXT_NUMBERS } from '../task/native-notice.mjs';
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
} from '../task/wram.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { CODE_BANK_BASE, WRAM_BANK } from '../constants/memory-map.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// The callees and their call sites.
const OPEN_WINDOW = [0x80e1ee, 0x80f963],
  MENU = [0x80e229, 0x80a6c7],
  RELEASE_WINDOW = [0x80e247, 0x80fa3e];
// The menu's first column and its cancel word, and the result without a spell.
const MENU_COLUMN = 1,
  CANCELLED = WORD_MASK,
  NO_SPELL = 0;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const setFlag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const setSignZero = (ctx, value) => {
  setFlag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  setFlag(ctx, FLAG_ZERO, value === 0);
};
const load = (ctx, value) => {
  ctx.a = value;
  setSignZero(ctx, value);
};
const call = (h, events, routines, [pc, target]) =>
  nativeCallSequence(h, events, routines, pc, target, false, false);

// The menu list: each learned spell's name text (in the order of the list) after Exit.
// Leaves X past the last name and Y the last spell doubled; returns the carry of that
// doubling. The original has no bound; the port stops after 8000 spells.
function listSpellNames(h) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  let x = 0,
    carry = false;
  for (let n = 0; ; n++) {
    if (n === LIST_ENTRY_LIMIT) taskStop('task_native_e1cf_list_unbounded');
    const spell = word(wram, SPELL_LIST + x);
    if (spell === 0) break;
    carry = (spell & WORD_SIGN) !== 0;
    ctx.y = (spell << 1) & WORD_MASK;
    setDataBankWord(mem, SPELL_CHOICE_NAMES, x, dataBankWord(mem, TEXT_NUMBERS, ctx.y));
    x = (x + 2) & WORD_MASK;
  }
  setDataBankWord(mem, SPELL_CHOICE_NAMES, x, 0);
  setDataBankWord(mem, SPELL_CHOICE_HEADER, 0, TEXT_EXIT);
  ctx.x = x;
  return carry;
}

// The spell of the chosen menu row (the row's list word before it), or null for Exit
// or a cancel; leaves A, X and the flags as the original's tests.
function chosenSpell(h, row) {
  const { ctx } = h,
    { wram } = h.a.mem;
  ctx.a = row;
  if (row === CANCELLED) {
    // The compare's carry; its sign and zero are overwritten before any call.
    setFlag(ctx, FLAG_CARRY, true);
    return null;
  }
  const doubled = (row << 1) & WORD_MASK;
  setFlag(ctx, FLAG_CARRY, row & WORD_SIGN);
  load(ctx, doubled);
  // Exit (row 0) doubles to 0, and so does 8000.
  if (doubled === 0) return null;
  ctx.x = (doubled - 2) & WORD_MASK;
  const spell = word(wram, SPELL_LIST + ctx.x);
  load(ctx, spell);
  return spell;
}

// 80:E1CF: choose one of the learned spells; DP 00 gets it or 0. A sequence that ends
// with the native's RTS.
export function* chooseSpellSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  let spells,
    spell = null;
  yield () => {
    const first = word(wram, SPELL_LIST);
    load(ctx, first);
    spells = first !== 0;
    if (!spells) return;
    for (const [offset, value] of [
      [DP_WINDOW_LEFT, SPELL_WINDOW.left],
      [DP_WINDOW_TOP, SPELL_WINDOW.top],
      [DP_WINDOW_COLUMNS, SPELL_WINDOW.columns],
      [DP_WINDOW_ROWS, SPELL_WINDOW.rows],
      [DP_WINDOW_ATTRIBUTES, 0],
    ])
      setWord(wram, offset, value);
    load(ctx, 0);
    // Another language fits the window to the names before it opens.
    if (mem.language) {
      const ids = listTextIds(mem, (WRAM_BANK << WORD_BITS) + SPELL_LIST, LIST_ENTRY_LIMIT).map(
        (number) => mem.read16(CODE_BANK_BASE | (TEXT_NUMBERS + 2 * number)),
      );
      fitListWindow(mem, h, [TEXT_EXIT, ...ids]);
    }
  };
  if (spells) {
    yield* call(h, events, routines, OPEN_WINDOW);
    yield () => {
      setWord(wram, DP_SPELL_WINDOW, word(wram, 0));
      const carry = listSpellNames(h);
      setWord(wram, DP_MENU_COLUMN, MENU_COLUMN);
      setWord(wram, DP_MENU_ROW, 0);
      setWord(wram, DP_MENU_VISIBLE_ROWS, SPELL_WINDOW.visibleRows);
      setWord(wram, DP_LIST_TOKENS, SPELL_CHOICE_HEADER);
      setWord(wram, DP_LIST_TOKEN_BANK, WRAM_BANK);
      load(ctx, WRAM_BANK);
      setFlag(ctx, FLAG_CARRY, carry);
    };
    yield* call(h, events, routines, MENU);
    yield () => {
      spell = chosenSpell(h, word(wram, 0));
    };
  }
  yield () => {
    // The result waits on the stack while the window is released.
    h.a.pushWord(spell ?? NO_SPELL);
    const window = word(wram, DP_SPELL_WINDOW);
    load(ctx, window);
    setWord(wram, 0, window);
  };
  yield* call(h, events, routines, RELEASE_WINDOW);
  let result;
  yield () => {
    const chosen = h.a.pullWord();
    load(ctx, chosen);
    setWord(wram, 0, chosen);
    result = h.rts();
  };
  return result;
}
