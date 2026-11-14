// A member's spell menu (lifted from the script native 80:F254 and its menu 80:E693;
// register-level version in src/task/native-member-spell-menu.mjs, which recorded waits
// and inputs replay).
//
// 80:F254 opens the menu for the object DP 00 while the member menu mark 7E:1F62 is
// FFFF: the object's number is looked up among the runners (from the last; none leaves
// FFFE), and the number, object and runner index are kept (1F5A, 1F5C, 1F60). The long
// pointer DP F9 points at the runner's skills in its record.
//
// 80:E693 lists the spells the runner knows (a level byte per spell slot of the record)
// after Exit in a window (80:F963 at 0B, 0F, 12 columns and three rows more than
// spells) with a menu (80:A6C7, seven rows visible): the level's name per row and, per
// row, the spell's name, leader and other scripts, its slot's address in the record
// and its level. Choosing a spell as the leader selects it (7E:3C13, 3C15, 3C1A);
// another member's choice appends and visits the spell's script (80:C34A, 80:C1CA) when
// 1F68 is set, then redraws the window list and the portrait if the script asks for it
// (81:AEB0, 80:E4B3) and waits for a key when a notice window is open (80:F953,
// 80:FF79). A negative row ends the dialog (7E:1D7B). The window is released (80:FA3E).
// The entry 80:E68E (from the status screen) leaves 1F68 clear: no script runs and the
// equipment window is drawn at the end (80:E9C5). The callees run through their frames
// from the routine table, each with its own callees.
import { dialogCallBody, nativeCallSequence } from '../task/native-call-continuation.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import {
  SPELL_LEVEL_NAMES,
  SPELL_NAMES,
  SPELL_SCRIPTS_A,
  SPELL_SCRIPTS_B,
  SPELL_SLOT_FIRST,
  SPELL_WINDOW as MENU_WINDOW,
} from '../task/native-member-spell-menu.mjs';
import {
  DIALOG_END,
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_MEMBER_RECORD,
  DP_MEMBER_RECORD_BANK,
  DP_MENU_COLUMN,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  MEMBER_INDEX,
  MEMBER_MENU_ACTIVE,
  MEMBER_MENU_NAMES,
  MEMBER_NUMBER,
  MEMBER_OBJECT,
  MEMBER_PORTRAIT_REDRAW,
  NOTICE_WINDOW_LAST,
  NOTICE_WINDOWS,
  OBJECT_NUMBER,
  PLAYER_OBJECT,
  SELECTED_SPELL_LEVEL_POINTER,
  SELECTED_SPELL_NAME,
  SELECTED_SPELL_SCRIPT,
  SPELL_CHOICE_RUNS_SCRIPT,
  SPELL_MENU_LEADER_SCRIPTS,
  SPELL_MENU_LEVEL_POINTERS,
  SPELL_MENU_LEVELS,
  SPELL_MENU_SCRIPTS,
  SPELL_MENU_SPELL_NAMES,
  STATUS_SUBMENU_WINDOW,
} from '../task/wram.mjs';
import {
  RUNNER_LAST_INDEX,
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_BANKS,
  RUNNER_RECORD_POINTERS,
  SKILLS_START,
  SPELL_COUNT,
} from '../data/runners.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { translatedListWindow } from '../data/menu-layout.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  HIGH_BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// The callees and their call sites.
const OPEN_WINDOW = [0x80e6ce, 0x80f963],
  MENU = [0x80e74c, 0x80a6c7],
  APPEND_SCRIPT = [0x80e788, 0x80c34a],
  VISIT_SCRIPT = [0x80e78e, 0x80c1ca],
  REDRAW_LIST = [0x80e79b, 0x81aeb0],
  SHOW_PORTRAIT = [0x80e79f, 0x80e4b3],
  CONFIRM_KEY = [0x80e7b1, 0x80f953],
  RELEASE_NOTICES = [0x80e7b4, 0x80ff79],
  RELEASE_WINDOW = [0x80e7bc, 0x80fa3e],
  SHOW_EQUIPMENT = [0x80e7c4, 0x80e9c5],
  SPELL_MENU = [0x80f289, 0x80e693];
// The entry from the status screen, which runs no scripts.
export const STATUS_ENTRY = 0x80e68e;
const MENU_ENTRY = 0x80e693;
// The spell slots in the record after the skills; the list offset DP 04 (the menu's
// row when it opens), the level row scratch DP 02, the menu's first column; a level's
// names are twelve bytes apart (two per spell).
const SPELL_SLOT_END = SPELL_SLOT_FIRST + SPELL_COUNT,
  SLOT_INDEX_BIAS = 2 * SPELL_SLOT_FIRST,
  DP_LIST_OFFSET = DP_MENU_ROW,
  DP_LEVEL_ROW = 2,
  MENU_COLUMN = 1,
  LEVEL_ROW_BYTES = 12,
  LEVEL_NAMES = 0x80e7c8,
  MARK_SET = WORD_MASK;

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
const negative = (value) => (value & WORD_SIGN) !== 0;
// left + right + carry on words, with the carry and the signed overflow.
function add(left, right, carry = false) {
  const sum = left + right + (carry ? 1 : 0),
    value = sum & WORD_MASK;
  return { value, carry: sum > WORD_MASK, overflow: negative(~(left ^ right) & (left ^ value)) };
}
const call = (h, events, routines, [pc, target], long = false) =>
  nativeCallSequence(h, events, routines, pc, target, long, false);
function* returnSequence(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// The level byte of a spell slot in the runner's record (long pointer DP F9).
function spellLevel(mem, slot) {
  const { wram } = mem,
    record = word(wram, DP_MEMBER_RECORD) | (wram[DP_MEMBER_RECORD_BANK] << WORD_BITS);
  return mem.read8((record + slot) & LONG_MASK);
}
// The window's shape: another language fits it to Exit and the level names.
function menuWindow(mem) {
  if (!mem.language) return MENU_WINDOW;
  const ids = [TEXT_EXIT];
  for (let slot = SPELL_SLOT_FIRST; slot < SPELL_SLOT_END; slot++) {
    const level = spellLevel(mem, slot);
    if (level)
      ids.push(mem.read16(LEVEL_NAMES + ((level - 1) * SPELL_COUNT + slot - SPELL_SLOT_FIRST) * 2));
  }
  return translatedListWindow(mem, MENU_WINDOW, ids);
}

// The menu rows of the known spells after Exit (see above). Leaves X the last row's
// offset and the overflow of the last level name's index.
function listSpells(h) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  setWord(wram, DP_LIST_OFFSET, 0);
  setDataBankWord(mem, MEMBER_MENU_NAMES, 0, TEXT_EXIT);
  let offset = 0;
  for (let slot = SPELL_SLOT_FIRST; slot < SPELL_SLOT_END; slot++) {
    const level = spellLevel(mem, slot);
    if (!level) continue;
    const levelRow = ((level - 1) * LEVEL_ROW_BYTES) & WORD_MASK,
      slotIndex = (slot << 1) & WORD_MASK,
      address = add(slot, word(wram, DP_MEMBER_RECORD)),
      // The level name's index adds the carry of the slot's address.
      nameIndex = add(slotIndex, levelRow, address.carry),
      column = (table, index) => dataBankWord(mem, table - SLOT_INDEX_BIAS, index);
    setWord(wram, DP_LEVEL_ROW, levelRow);
    offset = (offset + 2) & WORD_MASK;
    setWord(wram, DP_LIST_OFFSET, offset);
    setDataBankWord(mem, MEMBER_MENU_NAMES, offset, column(SPELL_LEVEL_NAMES, nameIndex.value));
    setDataBankWord(mem, SPELL_MENU_SPELL_NAMES, offset, column(SPELL_NAMES, slotIndex));
    setDataBankWord(mem, SPELL_MENU_LEADER_SCRIPTS, offset, column(SPELL_SCRIPTS_B, slotIndex));
    setDataBankWord(mem, SPELL_MENU_SCRIPTS, offset, column(SPELL_SCRIPTS_A, slotIndex));
    setDataBankWord(mem, SPELL_MENU_LEVEL_POINTERS, offset, address.value);
    setDataBankWord(mem, SPELL_MENU_LEVELS, offset, level);
    setFlag(ctx, FLAG_OVERFLOW, nameIndex.overflow);
  }
  ctx.x = offset;
  setDataBankWord(mem, MEMBER_MENU_NAMES + 2, offset, 0);
}

// The leader's choice: the row's script, level pointer and spell name selected. Leaves
// A the name.
function selectSpell(h, row) {
  const { mem } = h.a;
  for (const [column, target] of [
    [SPELL_MENU_LEADER_SCRIPTS, SELECTED_SPELL_SCRIPT],
    [SPELL_MENU_LEVEL_POINTERS, SELECTED_SPELL_LEVEL_POINTER],
    [SPELL_MENU_SPELL_NAMES, SELECTED_SPELL_NAME],
  ]) {
    const value = dataBankWord(mem, column, row);
    setWord(mem.wram, target, value);
    load(h.ctx, value);
  }
}

// After a visited script: the window list and portrait redrawn when it asks for it, and
// a key awaited while a notice window is open.
function* afterScriptSequence(h, events, routines) {
  const { ctx } = h,
    { wram } = h.a.mem;
  let ended, redraw;
  yield () => {
    const end = word(wram, DIALOG_END);
    load(ctx, end);
    ended = end !== 0;
    if (ended) return;
    redraw = word(wram, MEMBER_PORTRAIT_REDRAW);
    load(ctx, redraw);
  };
  if (ended) return;
  if (redraw) {
    yield* call(h, events, routines, REDRAW_LIST, true);
    yield* call(h, events, routines, SHOW_PORTRAIT);
  }
  let pending = false;
  yield () => {
    let x = NOTICE_WINDOW_LAST;
    for (;;) {
      const window = word(wram, NOTICE_WINDOWS + x);
      load(ctx, window);
      if (!negative(window)) {
        pending = true;
        break;
      }
      x = (x - 2) & WORD_MASK;
      if (negative(x)) break;
    }
    // Without a notice window the release's load overwrites the sign and zero of X.
    ctx.x = x;
  };
  if (pending) {
    yield* call(h, events, routines, CONFIRM_KEY);
    yield* call(h, events, routines, RELEASE_NOTICES);
  }
}

// 80:E693 (or the entry 80:E68E): the spell menu of the member in 1F5C with its record
// at DP F9. A sequence that ends with its RTS.
export function* spellMenuSequence(h, events, routines, entry = MENU_ENTRY) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  let known = 0;
  yield () => {
    if (entry === STATUS_ENTRY) setWord(wram, SPELL_CHOICE_RUNS_SCRIPT, 0);
    else setWord(wram, SPELL_CHOICE_RUNS_SCRIPT, MARK_SET);
    for (let slot = SPELL_SLOT_FIRST; slot < SPELL_SLOT_END; slot++)
      if (spellLevel(mem, slot)) known++;
    // The slot and count compares leave the carry; A is loaded again before any call.
    ctx.x = known;
    ctx.y = SPELL_SLOT_END;
    setSignZero(ctx, known);
    setFlag(ctx, FLAG_CARRY, true);
    if (!known) return;
    const rows = known + MENU_WINDOW.extraRows,
      window = menuWindow(mem);
    ctx.x = rows;
    setWord(wram, DP_WINDOW_ROWS, rows);
    setWord(wram, DP_WINDOW_LEFT, window.left);
    setWord(wram, DP_WINDOW_TOP, window.top);
    setWord(wram, DP_WINDOW_COLUMNS, window.columns);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
    load(ctx, 0);
  };
  if (known) {
    yield* call(h, events, routines, OPEN_WINDOW);
    yield () => {
      setDataBankWord(mem, STATUS_SUBMENU_WINDOW, 0, word(wram, 0));
      listSpells(h);
      setWord(wram, DP_MENU_COLUMN, MENU_COLUMN);
      setWord(wram, DP_MENU_ROW, 0);
      setWord(wram, DP_MENU_VISIBLE_ROWS, MENU_WINDOW.visibleRows);
      setWord(wram, DP_LIST_TOKENS, MEMBER_MENU_NAMES);
      setWord(wram, DP_LIST_TOKEN_BANK, WRAM_BANK);
      load(ctx, WRAM_BANK);
      ctx.y = SPELL_SLOT_END;
      setFlag(ctx, FLAG_CARRY, true);
    };
    yield* call(h, events, routines, MENU);
    let script = false;
    yield () => {
      const chosen = word(wram, 0);
      load(ctx, chosen);
      if (chosen === 0) return;
      if (negative(chosen)) {
        setWord(wram, DIALOG_END, chosen);
        return;
      }
      const row = (chosen << 1) & WORD_MASK;
      ctx.y = row;
      ctx.x = dataBankWord(mem, SPELL_MENU_SCRIPTS, row);
      setWord(wram, 0, dataBankWord(mem, SPELL_MENU_LEVELS, row));
      const member = dataBankWord(mem, MEMBER_OBJECT),
        player = dataBankWord(mem, PLAYER_OBJECT);
      setFlag(ctx, FLAG_CARRY, member >= player);
      if (member === player) return selectSpell(h, row);
      const runs = word(wram, SPELL_CHOICE_RUNS_SCRIPT);
      load(ctx, runs);
      script = runs !== 0;
    };
    if (script) {
      yield* call(h, events, routines, APPEND_SCRIPT);
      yield () => setWord(wram, MEMBER_PORTRAIT_REDRAW, 0);
      yield* call(h, events, routines, VISIT_SCRIPT);
      yield* afterScriptSequence(h, events, routines);
    }
    yield () => {
      const window = dataBankWord(mem, STATUS_SUBMENU_WINDOW);
      load(ctx, window);
      setWord(wram, 0, window);
    };
    yield* call(h, events, routines, RELEASE_WINDOW);
  }
  let equipment;
  yield () => {
    const runs = word(wram, SPELL_CHOICE_RUNS_SCRIPT);
    load(ctx, runs);
    equipment = runs === 0;
  };
  if (equipment) yield* call(h, events, routines, SHOW_EQUIPMENT);
  return yield* returnSequence(h);
}

// 80:F254: the spell menu of the object DP 00 (see above). A sequence that ends with the
// native's RTS.
export function* openSpellMenuSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  yield () => {
    setWord(wram, MEMBER_MENU_ACTIVE, MARK_SET);
    const object = word(wram, 0),
      number = dataBankWord(mem, OBJECT_NUMBER, object);
    let runner = RUNNER_LAST_INDEX;
    while (number !== dataBankWord(mem, RUNNER_OBJECT_NUMBERS, runner)) {
      runner = (runner - 2) & WORD_MASK;
      if (negative(runner)) break;
    }
    setWord(wram, MEMBER_NUMBER, number);
    setWord(wram, MEMBER_OBJECT, object);
    setWord(wram, MEMBER_INDEX, runner);
    const skills = add(dataBankWord(mem, RUNNER_RECORD_POINTERS, runner), SKILLS_START),
      bank = dataBankWord(mem, RUNNER_RECORD_BANKS, runner) & BYTE_MASK;
    setWord(wram, DP_MEMBER_RECORD, skills.value);
    wram[DP_MEMBER_RECORD_BANK] = bank;
    setWord(wram, DIALOG_END, 0);
    // The bank byte is loaded with an 8-bit A: the sum's high byte stays.
    ctx.a = (skills.value & HIGH_BYTE_MASK) | bank;
    ctx.x = runner;
    ctx.y = object;
    setFlag(ctx, FLAG_NEGATIVE, bank & (1 << (BYTE_BITS - 1)));
    setFlag(ctx, FLAG_ZERO, bank === 0);
    setFlag(ctx, FLAG_CARRY, skills.carry);
    setFlag(ctx, FLAG_OVERFLOW, skills.overflow);
  };
  if (routines.has(SPELL_MENU[1])) yield* call(h, events, routines, SPELL_MENU);
  else
    yield* dialogCallBody(h, SPELL_MENU[0], SPELL_MENU[1], () =>
      spellMenuSequence(h, events, routines),
    );
  yield () => setWord(wram, MEMBER_MENU_ACTIVE, 0);
  return yield* returnSequence(h);
}
