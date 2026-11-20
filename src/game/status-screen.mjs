// The status screen of a group member (lifted from 80:EA6E, 80:EA89 and 80:EA8E;
// register-level version statusSequence in proof/replay/native-status-screen.mjs, which
// recorded waits and inputs replay).
//
// The entries: the script native 80:EA6E shows the object DP 00; the player control's
// 80:EA89 (Start) and 80:EA8E (Y, the item submenu at once, 7E:1F64 FFFF) show the
// object under the glove (01DA not negative: 01DE) or the leader (0CC2). The sound is
// dimmed (command 2 to 2F2F, 81:F007), the member menu mark 1F62 set and open notice
// windows released (80:FF79). An object whose number is not in the group (7E:2DF0)
// gives way to the leader; a leader outside the group stops. The object's state count
// (7E:0002 of its record) goes to 1F5E, its number, object and runner index to 1F5A,
// 1F5C and 1F60, the record pointer to DP F9 and the portrait (Jake's alternate with
// 7E:3C17) and datajack to 1F54 and 1F56. After the glove (80:BCB2) and 81:886A the
// status window (02, 02, 1E by 1A, its number in 1F4C) shows the attribute rows
// (80:ED0E, labels 80:ED16; the record's third byte is skipped), the state count, the
// magic points over ten times Magic, and for Jake karma, money (80:FDCF) and the spell
// label; then the weapon and armour labels, the equipment rows (80:E9C5) and the
// portrait (80:E4B3). The menu (80:ED1E in a window at 15, 03, its number in 1F4E)
// runs a submenu of the table 80:ED2E (JMP (ED2E,X) inside JSR ECEA) until one sets
// 7E:1D63 or the menu ends; 1F64 set runs the first submenu once and keeps no menu
// window. At the end 80:92C5, the windows are released, 1F62 is cleared and the sound
// restored (7F7F). Menus, text and displays compose through their original
// frames, including sound and colour setup; scene cleanup also composes directly.
//
// Registers (user decision 2026-11-17): game state only; the APU command 81:F007
// takes the command and its value as parameters (A and X in the original). The object the
// native keeps on the stack over the notice release (PEI, PLY) is a local.
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { openWindow } from './window-open.mjs';
import {
  releaseWindowSequence,
  releaseNoticeWindowsSequence,
  putGloveAwaySequence,
} from './window-release.mjs';
import { setTextCursor, printNumber } from './window-text.mjs';
import { printText } from './text-print.mjs';
import { decimalNumberSequence } from './decimal-number.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { equipmentRows } from './equipment-window.mjs';
import { memberPortrait } from './member-portrait.mjs';
import { closeDialog, clearFixedColourRoutine } from './dialog-talk.mjs';
import { sendApuCommandCall } from '../apu/audio-routines.mjs';
import { chooseFromMenuSequence, MENU } from './menu-choice.mjs';
import { itemMenuSequence, ITEM_ENTRIES } from './item-menu.mjs';
import { spellMenuSequence, STATUS_ENTRY } from './member-spell-menu.mjs';
import { skillsSequence, notesSequence } from './status-submenus.mjs';
import { taskStop } from '../system/task-stop.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { DP_SCRATCH, STATUS_LAYOUT } from '../data/native-member-spell-menu.mjs';
import {
  ATTRIBUTE_ROWS,
  DP_MAGIC_MAXIMUM,
  MENU_WINDOW,
  STATUS_MENU_ITEMS,
  STATUS_ROWS,
  STATUS_VOLUME_TARGET,
  STATUS_WINDOW_SHAPE,
  TEXT_MONEY,
  TEXT_SLASH,
  translatedMenuWindow,
} from '../system/native-status-screen.mjs';
import {
  DIALOG_END,
  DP_CURSOR_ROW,
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
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  GROUP_INDEX,
  GROUP_NUMBERS,
  JAKE_ALTERNATE_PORTRAIT,
  KARMA,
  MAGIC_POINTS,
  MEMBER_DATAJACK,
  MEMBER_INDEX,
  MEMBER_MENU_ACTIVE,
  MEMBER_NUMBER,
  MEMBER_OBJECT,
  MEMBER_PORTRAIT,
  MEMBER_STATE_COUNT,
  NUYEN,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  PLAYER_OBJECT,
  STATUS_ITEMS_AT_ONCE,
  STATUS_MENU_WINDOW,
  STATUS_WINDOW,
  WRAM,
} from '../data/wram.mjs';
import {
  JAKE_ALTERNATE_PORTRAIT_DIALOG,
  JAKE_OBJECT_NUMBER,
  RECORD_MAGIC,
  RUNNER_DATAJACKS,
  RUNNER_LAST_INDEX,
  RUNNER_OBJECT_NUMBERS,
  RUNNER_PORTRAITS,
  RUNNER_RECORD_BANKS,
  RUNNER_RECORD_POINTERS,
} from '../data/runners.mjs';
import { STATE_COUNT } from '../data/actors.mjs';
import { APU_COMMAND_VOLUME_TARGET } from '../constants/sound-commands.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';

// The entries: the script native, Start and Y in the player control.
export const NATIVE_ENTRY = 0x80ea6e,
  START_ENTRY = 0x80ea89,
  ITEMS_ENTRY = 0x80ea8e;
const SOUND = 0x81f007,
  STATUS_SETUP = 0x81886a,
  DECIMAL_NUMBER = 0x80fdcf,
  PLAIN_MENU = MENU,
  SKILLS_MENU = 0x80e834,
  NOTES_MENU = 0x80e8c8;
// The attribute labels follow the rows; the attributes from index 6 down, the record's
// byte after the third attribute is skipped; the submenus' jump table; the restored
// sound level; the mark set; the first submenu (items) for 1F64.
const ATTRIBUTE_LABELS = 0xed16,
  LAST_ATTRIBUTE = 6,
  SKIPPED_AFTER = 2,
  SUBMENUS = 0xed2e,
  FULL_VOLUME = 0x7f7f,
  MARK_SET = WORD_MASK,
  FIRST_SUBMENU = 1,
  MENU_COLUMN = 1,
  // Ten times Magic: Magic doubled, then times four plus the double.
  MAGIC_SCALE_SHIFT = 2,
  KARMA_SHIFT = 3,
  // The money's 32-bit number for 80:FDCF.
  DP_NUMBER_LOW = 2,
  DP_NUMBER_HIGH = 4;
const TEXT_KARMA = 0x7117,
  TEXT_SPELL = 0x7484,
  TEXT_WEAPON = 0x7125,
  TEXT_ARMOUR = 0x70b6;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const negative = (value) => (value & WORD_SIGN) !== 0;
// A long word read: WRAM fields indexed past their bank reach the next one.
const longWord = (mem, address) => mem.read16(address & LONG_MASK);
function* returnSequence(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// 80:EA6E, 80:EA89 or 80:EA8E: the status screen (see above) for lifted callers, without
// the JSR frame (the caller's return word lies only in free stack bytes).
export function* statusScreen(
  h,
  events,
  entry = NATIVE_ENTRY,
  renderBuffer = drawTextBufferSequence,
) {
  const { mem } = h.a,
    { wram } = mem,
    native = entry === NATIVE_ENTRY;
  // The record pointer DP F9 and its word, which the attribute rows step through.
  const record = () => word(wram, DP_MEMBER_RECORD) | (wram[DP_MEMBER_RECORD_BANK] << WORD_BITS);
  const nextRecordByte = () => {
    const value = longWord(mem, record()) & BYTE_MASK;
    setWord(wram, DP_MEMBER_RECORD, word(wram, DP_MEMBER_RECORD) + 1);
    return value;
  };
  // The cursor (column DP 02, row DP 1D or kept), a text and a number.
  const cursor = function* (column, row) {
    yield () => {
      setWord(wram, 2, column);
      if (row !== undefined) setWord(wram, DP_CURSOR_ROW, row);
    };
    yield* segmentSequence(() => setTextCursor(h));
  };
  const text = function* (id) {
    yield () => setWord(wram, 2, id);
    yield* printText(h, events, renderBuffer);
  };
  const number = function* (value) {
    yield () => setWord(wram, 2, value());
    yield* printNumber(h, events, renderBuffer);
  };
  // The object's state count from its record.
  const keepStateCount = (object) => {
    const at = dataBankWord(mem, OBJECT_RECORD, object);
    setDataBankWord(mem, MEMBER_STATE_COUNT, 0, longWord(mem, WRAM + STATE_COUNT + at) & BYTE_MASK);
  };
  // Whether the object's number is in the group (searched from the group's index down).
  const inGroup = (object) => {
    const objectNumber = dataBankWord(mem, OBJECT_NUMBER, object);
    for (let at = word(wram, GROUP_INDEX); !negative(at); at = (at - 2) & WORD_MASK)
      if (longWord(mem, WRAM + GROUP_NUMBERS + at) === objectNumber) return true;
    return false;
  };

  yield () => {
    setWord(wram, STATUS_ITEMS_AT_ONCE, entry === ITEMS_ENTRY ? MARK_SET : 0);
  };
  yield* dialogCallBody(
    h,
    native ? 0x80ea77 : 0x80ea9a,
    SOUND,
    () =>
      segmentSequence(() => sendApuCommandCall(h, APU_COMMAND_VOLUME_TARGET, STATUS_VOLUME_TARGET)),
    true,
  );
  // The native keeps its object DP 00 over the release (PEI, PLY in the original).
  let object;
  yield () => {
    setWord(wram, MEMBER_MENU_ACTIVE, MARK_SET);
    if (native) object = word(wram, 0);
  };
  yield* releaseNoticeWindowsSequence(h, events);
  yield () => {
    if (!native) {
      const tag = dataBankWord(mem, GLOVE_TARGET_TAG);
      object = dataBankWord(mem, negative(tag) ? PLAYER_OBJECT : GLOVE_TARGET_OBJECT);
    }
    keepStateCount(object);
    if (!inGroup(object)) {
      object = dataBankWord(mem, PLAYER_OBJECT);
      keepStateCount(object);
      if (!inGroup(object)) taskStop('task_ea6e_endless_search');
    }
    // The runner of the object's number (from the last; none leaves FFFE).
    const number = dataBankWord(mem, OBJECT_NUMBER, object);
    let runner = RUNNER_LAST_INDEX;
    while (number !== dataBankWord(mem, RUNNER_OBJECT_NUMBERS, runner)) {
      runner = (runner - 2) & WORD_MASK;
      if (negative(runner)) break;
    }
    setWord(wram, MEMBER_NUMBER, number);
    setWord(wram, MEMBER_OBJECT, object);
    setWord(wram, MEMBER_INDEX, runner);
  };
  yield* putGloveAwaySequence(h, events);
  yield* dialogCallBody(
    h,
    0x80eaed,
    STATUS_SETUP,
    () => segmentSequence(() => clearFixedColourRoutine(h)),
    true,
  );
  yield () => {
    const runner = dataBankWord(mem, MEMBER_INDEX);
    setWord(wram, DP_MEMBER_RECORD, dataBankWord(mem, RUNNER_RECORD_POINTERS, runner));
    const alternate = runner === 0 && wram[JAKE_ALTERNATE_PORTRAIT] !== 0;
    setWord(
      wram,
      MEMBER_PORTRAIT,
      alternate ? JAKE_ALTERNATE_PORTRAIT_DIALOG : dataBankWord(mem, RUNNER_PORTRAITS, runner),
    );
    setWord(wram, MEMBER_DATAJACK, dataBankWord(mem, RUNNER_DATAJACKS, runner));
    wram[DP_MEMBER_RECORD_BANK] = mem.read8(
      (CODE_BANK_BASE + RUNNER_RECORD_BANKS + runner) & LONG_MASK,
    );
    setWord(wram, DIALOG_END, 0);
    setWord(wram, DP_WINDOW_LEFT, STATUS_WINDOW_SHAPE.left);
    setWord(wram, DP_WINDOW_TOP, STATUS_WINDOW_SHAPE.top);
    setWord(wram, DP_WINDOW_COLUMNS, STATUS_WINDOW_SHAPE.columns);
    setWord(wram, DP_WINDOW_ROWS, STATUS_WINDOW_SHAPE.rows);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
  };
  yield* openWindow(h, events);
  yield () => {
    setWord(wram, STATUS_WINDOW, word(wram, 0));
    const doubled = (longWord(mem, record() + RECORD_MAGIC) & BYTE_MASK) << 1;
    setWord(wram, DP_MAGIC_MAXIMUM, (doubled << MAGIC_SCALE_SHIFT) + doubled);
  };
  // The attribute rows from the last; a callee may change the index kept in DP 6B.
  let at = LAST_ATTRIBUTE;
  do {
    yield () => {
      setWord(wram, 2, STATUS_ROWS.labelColumn);
      setWord(wram, DP_CURSOR_ROW, dataBankWord(mem, ATTRIBUTE_ROWS, at));
      setWord(wram, DP_SCRATCH, at);
    };
    yield* segmentSequence(() => setTextCursor(h));
    yield () => setWord(wram, 2, dataBankWord(mem, ATTRIBUTE_LABELS, word(wram, DP_SCRATCH)));
    yield* printText(h, events, renderBuffer);
    yield* cursor(STATUS_LAYOUT.valueColumn);
    yield () => {
      const value = nextRecordByte();
      if (word(wram, DP_SCRATCH) === SKIPPED_AFTER)
        setWord(wram, DP_MEMBER_RECORD, word(wram, DP_MEMBER_RECORD) + 1);
      setWord(wram, 2, value);
    };
    yield* printNumber(h, events, renderBuffer);
    yield () => {
      at = (word(wram, DP_SCRATCH) - 2) & WORD_MASK;
    };
  } while (!negative(at));
  yield* cursor(STATUS_ROWS.countColumn, STATUS_ROWS.stateCountRow);
  yield* number(() => dataBankWord(mem, MEMBER_STATE_COUNT));
  yield* text(TEXT_SLASH);
  yield* number(nextRecordByte);
  yield* cursor(STATUS_ROWS.countColumn, STATUS_ROWS.magicRow);
  yield* number(
    () => longWord(mem, WRAM + MAGIC_POINTS + (dataBankWord(mem, MEMBER_INDEX) >>> 1)) & BYTE_MASK,
  );
  yield* text(TEXT_SLASH);
  yield* number(() => word(wram, DP_MAGIC_MAXIMUM));
  let jake;
  yield () => {
    jake = dataBankWord(mem, MEMBER_NUMBER) === JAKE_OBJECT_NUMBER;
  };
  if (jake) {
    yield* cursor(STATUS_ROWS.labelColumn, STATUS_ROWS.karmaRow);
    yield* text(TEXT_KARMA);
    yield* cursor(STATUS_LAYOUT.valueColumn);
    yield* number(() => longWord(mem, WRAM + KARMA) >>> KARMA_SHIFT);
    yield* cursor(STATUS_ROWS.labelColumn, STATUS_ROWS.moneyRow);
    yield* text(TEXT_MONEY);
    yield* cursor(STATUS_LAYOUT.valueColumn);
    yield () => {
      setWord(wram, DP_NUMBER_LOW, longWord(mem, WRAM + NUYEN));
      setWord(wram, DP_NUMBER_HIGH, longWord(mem, WRAM + NUYEN + 2));
    };
    yield* dialogCallBody(h, 0x80ec42, DECIMAL_NUMBER, () =>
      decimalNumberSequence(h, events, renderBuffer),
    );
    yield* cursor(STATUS_ROWS.labelColumn, STATUS_ROWS.spellLabelRow);
    yield* text(TEXT_SPELL);
  }
  yield* cursor(STATUS_ROWS.labelColumn, STATUS_ROWS.weaponLabelRow);
  yield* text(TEXT_WEAPON);
  yield* cursor(STATUS_ROWS.labelColumn, STATUS_ROWS.armourLabelRow);
  yield* text(TEXT_ARMOUR);
  yield* equipmentRows(h, events, renderBuffer);
  yield* memberPortrait(h, events);

  let direct;
  yield () => {
    direct = dataBankWord(mem, STATUS_ITEMS_AT_ONCE) !== 0;
    if (direct) return;
    const window = translatedMenuWindow(h.a.mem);
    setWord(wram, DP_WINDOW_LEFT, window.left);
    setWord(wram, DP_WINDOW_TOP, window.top);
    setWord(wram, DP_WINDOW_COLUMNS, window.columns);
    setWord(wram, DP_WINDOW_ROWS, window.rows);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
  };
  if (!direct) {
    yield* openWindow(h, events);
    yield () => setWord(wram, STATUS_MENU_WINDOW, word(wram, 0));
  }
  for (;;) {
    let chosen, close;
    yield () => {
      if (direct) {
        chosen = FIRST_SUBMENU;
        return;
      }
      close = dataBankWord(mem, STATUS_ITEMS_AT_ONCE) !== 0;
      if (close) return;
      setWord(wram, 0, dataBankWord(mem, STATUS_MENU_WINDOW));
      setWord(wram, DP_MENU_COLUMN, MENU_COLUMN);
      setWord(wram, DP_MENU_ROW, 0);
      setWord(wram, DP_MENU_VISIBLE_ROWS, MENU_WINDOW.visibleRows);
      setWord(wram, DP_LIST_TOKENS, STATUS_MENU_ITEMS);
      setWord(wram, DP_LIST_TOKEN_BANK, CODE_BANK);
    };
    if (close) return yield* closeSequence(h, events);
    if (!direct) {
      yield* dialogCallBody(h, 0x80ecd0, PLAIN_MENU, () =>
        chooseFromMenuSequence(h, events, renderBuffer, MENU),
      );
      yield () => {
        chosen = word(wram, 0);
      };
      if (chosen === 0 || negative(chosen)) break;
    }
    direct = false;
    let submenu, submenuSequence;
    yield () => {
      const offset = (chosen << 1) & WORD_MASK;
      submenu = CODE_BANK_BASE | dataBankWord(mem, SUBMENUS, offset);
      if (Object.hasOwn(ITEM_ENTRIES, submenu))
        submenuSequence = itemMenuSequence(h, events, submenu, renderBuffer);
      else if (submenu === STATUS_ENTRY)
        submenuSequence = spellMenuSequence(h, events, STATUS_ENTRY, renderBuffer);
      else if (submenu === SKILLS_MENU) submenuSequence = skillsSequence(h, events, renderBuffer);
      else if (submenu === NOTES_MENU) submenuSequence = notesSequence(h, events, renderBuffer);
      else taskStop('task_ea6e_submenu_open', { pc: 0x80ecea, x: offset, target: submenu });
    };
    // JSR ECEA, whose JMP (ED2E,X) gives the submenu the JSR's frame.
    yield* dialogCallBody(h, 0x80ece0, submenu, () => submenuSequence);
    let ended;
    yield () => {
      ended = word(wram, DIALOG_END) !== 0;
    };
    if (ended) break;
  }
  yield () => setWord(wram, 0, dataBankWord(mem, STATUS_MENU_WINDOW));
  yield* releaseWindowSequence(h, events);
  return yield* closeSequence(h, events);
}
// The status screen as called with JSR (or as the script native); returns with its RTS.
export function* statusScreenSequence(
  h,
  events,
  entry = NATIVE_ENTRY,
  renderBuffer = drawTextBufferSequence,
) {
  yield* statusScreen(h, events, entry, renderBuffer);
  return yield* returnSequence(h);
}

// ECF5: the cleanup, the status window released, the mark cleared and the sound
// restored (the RTS follows in statusScreenSequence).
function* closeSequence(h, events) {
  const { mem } = h.a,
    { wram } = mem;
  yield* closeDialog(h, events);
  yield () => setWord(wram, 0, dataBankWord(mem, STATUS_WINDOW));
  yield* releaseWindowSequence(h, events);
  yield () => {
    setWord(wram, MEMBER_MENU_ACTIVE, 0);
  };
  yield* dialogCallBody(
    h,
    0x80ed09,
    SOUND,
    () => segmentSequence(() => sendApuCommandCall(h, APU_COMMAND_VOLUME_TARGET, FULL_VOLUME)),
    true,
  );
}
