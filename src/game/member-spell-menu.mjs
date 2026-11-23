import { readStateByte, writeStateByte } from '../state/objects.mjs';
// A member's spell menu (lifted from the script native 80:F254 and its menu 80:E693;
// register-level version in proof/replay/native-member-spell-menu.mjs, which recorded waits
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
// equipment window is drawn at the end (80:E9C5). Windows, selection and cleanup
// compose through their original frames; script append and nested visits compose directly.
//
// Registers (user decision 2026-11-17): game state only; the script task append 80:C34A
// takes the script as a parameter (X in the original). No register values are left.
import { objectWord } from '../state/objects.mjs';
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { scriptVisitCallSequence } from '../system/script-visit.mjs';
import { appendScriptCall } from '../script/task-api.mjs';
import { openWindow } from './window-open.mjs';
import { chooseFromMenu } from './menu-choice.mjs';
import { releaseWindowSequence, releaseNoticeWindowsSequence } from './window-release.mjs';
import { waitForConfirmKey } from './confirm-key.mjs';
import { equipmentRows } from './equipment-window.mjs';
import { memberPortrait } from './member-portrait.mjs';
import { resetWindowList } from './window-list.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import {
  SPELL_LEVEL_NAMES,
  SPELL_NAMES,
  SPELL_SCRIPTS_A,
  SPELL_SCRIPTS_B,
  SPELL_SLOT_FIRST,
  SPELL_WINDOW as MENU_WINDOW,
} from '../data/native-member-spell-menu.mjs';
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
} from '../data/wram.mjs';
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
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';

// The callees and their call sites.
const APPEND_SCRIPT = [0x80e788, 0x80c34a],
  VISIT_SCRIPT = 0x80e78e;
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

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const negative = (value) => (value & WORD_SIGN) !== 0;
// left + right + carry on words, with the carry.
function add(left, right, carry = false) {
  const sum = left + right + (carry ? 1 : 0);
  return { value: sum & WORD_MASK, carry: sum > WORD_MASK };
}
function* returnSequence(h, outerReturn = true) {
  let result;
  yield () => {
    if (outerReturn) result = h.rts();
  };
  return result;
}

// The level byte of a spell slot in the runner's record (long pointer DP F9).
function spellLevel(mem, slot) {
  const { wram } = mem,
    record =
      word(wram, DP_MEMBER_RECORD) | (readStateByte(wram, DP_MEMBER_RECORD_BANK) << WORD_BITS);
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

// The menu rows of the known spells after Exit (see above).
function listSpells(mem) {
  const { wram } = mem;
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
  }
  setDataBankWord(mem, MEMBER_MENU_NAMES + 2, offset, 0);
}

// The leader's choice: the row's script, level pointer and spell name selected.
function selectSpell(mem, row) {
  for (const [column, target] of [
    [SPELL_MENU_LEADER_SCRIPTS, SELECTED_SPELL_SCRIPT],
    [SPELL_MENU_LEVEL_POINTERS, SELECTED_SPELL_LEVEL_POINTER],
    [SPELL_MENU_SPELL_NAMES, SELECTED_SPELL_NAME],
  ]) {
    setWord(mem.wram, target, dataBankWord(mem, column, row));
  }
}

// After a visited script: the window list and portrait redrawn when it asks for it, and
// a key awaited while a notice window is open.
function* afterScriptSequence(h, events) {
  const { wram } = h.a.mem;
  let ended, redraw;
  yield () => {
    ended = word(wram, DIALOG_END) !== 0;
    if (!ended) redraw = word(wram, MEMBER_PORTRAIT_REDRAW);
  };
  if (ended) return;
  if (redraw) {
    yield* resetWindowList(h, events);
    yield* memberPortrait(h, events);
  }
  let pending = false;
  yield () => {
    let x = NOTICE_WINDOW_LAST;
    for (;;) {
      if (!negative(word(wram, NOTICE_WINDOWS + x))) {
        pending = true;
        break;
      }
      x = (x - 2) & WORD_MASK;
      if (negative(x)) break;
    }
  };
  if (pending) {
    yield* waitForConfirmKey(h, events);
    yield* releaseNoticeWindowsSequence(h, events);
  }
}

// 80:E693 (or the entry 80:E68E): the spell menu of the member in 1F5C with its record
// at DP F9, for lifted callers without the JSR frame; the menu choice, the script append
// and visit keep their own.
export function* spellMenu(h, events, entry = MENU_ENTRY, renderBuffer = drawTextBufferSequence) {
  const { mem } = h.a,
    { wram } = mem;
  let known = 0;
  yield () => {
    if (entry === STATUS_ENTRY) setWord(wram, SPELL_CHOICE_RUNS_SCRIPT, 0);
    else setWord(wram, SPELL_CHOICE_RUNS_SCRIPT, MARK_SET);
    for (let slot = SPELL_SLOT_FIRST; slot < SPELL_SLOT_END; slot++)
      if (spellLevel(mem, slot)) known++;
    if (!known) return;
    const rows = known + MENU_WINDOW.extraRows,
      window = menuWindow(mem);
    setWord(wram, DP_WINDOW_ROWS, rows);
    setWord(wram, DP_WINDOW_LEFT, window.left);
    setWord(wram, DP_WINDOW_TOP, window.top);
    setWord(wram, DP_WINDOW_COLUMNS, window.columns);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
  };
  if (known) {
    yield* openWindow(h, events);
    yield () => {
      setDataBankWord(mem, STATUS_SUBMENU_WINDOW, 0, word(wram, 0));
      listSpells(mem);
      setWord(wram, DP_MENU_COLUMN, MENU_COLUMN);
      setWord(wram, DP_MENU_ROW, 0);
      setWord(wram, DP_MENU_VISIBLE_ROWS, MENU_WINDOW.visibleRows);
      setWord(wram, DP_LIST_TOKENS, MEMBER_MENU_NAMES);
      setWord(wram, DP_LIST_TOKEN_BANK, WRAM_BANK);
    };
    yield* chooseFromMenu(h, events, renderBuffer, 0x80a6c7);
    let script = false,
      spellScript;
    yield () => {
      const chosen = word(wram, 0);
      if (chosen === 0) return;
      if (negative(chosen)) {
        setWord(wram, DIALOG_END, chosen);
        return;
      }
      const row = (chosen << 1) & WORD_MASK;
      spellScript = dataBankWord(mem, SPELL_MENU_SCRIPTS, row);
      setWord(wram, 0, dataBankWord(mem, SPELL_MENU_LEVELS, row));
      if (dataBankWord(mem, MEMBER_OBJECT) === dataBankWord(mem, PLAYER_OBJECT))
        return selectSpell(mem, row);
      script = word(wram, SPELL_CHOICE_RUNS_SCRIPT) !== 0;
    };
    if (script) {
      yield* dialogCallBody(h, ...APPEND_SCRIPT, () =>
        segmentSequence(() => appendScriptCall(h.a, spellScript)),
      );
      yield () => setWord(wram, MEMBER_PORTRAIT_REDRAW, 0);
      yield* scriptVisitCallSequence(h, events, VISIT_SCRIPT);
      yield* afterScriptSequence(h, events);
    }
    yield () => setWord(wram, 0, dataBankWord(mem, STATUS_SUBMENU_WINDOW));
    yield* releaseWindowSequence(h, events);
  }
  let equipment;
  yield () => {
    equipment = word(wram, SPELL_CHOICE_RUNS_SCRIPT) === 0;
  };
  if (equipment) yield* equipmentRows(h, events, renderBuffer);
}

// 80:F254: the spell menu of the object DP 00 (see above). A sequence that ends with the
// native's RTS.
export function* openSpellMenuSequence(
  h,
  events,
  renderBuffer = drawTextBufferSequence,
  outerReturn = true,
) {
  const { mem } = h.a,
    { wram } = mem;
  yield () => {
    setWord(wram, MEMBER_MENU_ACTIVE, MARK_SET);
    const object = word(wram, 0),
      number = objectWord(mem, 'number', object);
    let runner = RUNNER_LAST_INDEX;
    while (number !== dataBankWord(mem, RUNNER_OBJECT_NUMBERS, runner)) {
      runner = (runner - 2) & WORD_MASK;
      if (negative(runner)) break;
    }
    setWord(wram, MEMBER_NUMBER, number);
    setWord(wram, MEMBER_OBJECT, object);
    setWord(wram, MEMBER_INDEX, runner);
    const skills = (dataBankWord(mem, RUNNER_RECORD_POINTERS, runner) + SKILLS_START) & WORD_MASK;
    setWord(wram, DP_MEMBER_RECORD, skills);
    writeStateByte(
      wram,
      DP_MEMBER_RECORD_BANK,
      dataBankWord(mem, RUNNER_RECORD_BANKS, runner) & BYTE_MASK,
    );
    setWord(wram, DIALOG_END, 0);
  };
  yield* spellMenu(h, events, MENU_ENTRY, renderBuffer);
  yield () => setWord(wram, MEMBER_MENU_ACTIVE, 0);
  return yield* returnSequence(h, outerReturn);
}
