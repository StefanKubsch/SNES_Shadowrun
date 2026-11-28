import { memberMenuContent } from '../content/member-menus.mjs';
import { findRunnerIndex } from '../content/runners.mjs';
import { memberMenuState } from '../state/member-menu.mjs';
import { jakeState } from '../state/jake.mjs';
import { partyState } from '../state/party.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
// A selected party member: attributes, health, magic, equipment and portrait,
// followed by the item, spell, skill and notes submenus. Sound is dimmed until closing.
import { segmentSequence } from '../system/sequence-runner.mjs';
import { openWindow } from './window-open.mjs';
import {
  releaseWindowSequence,
  releaseNoticeWindowsSequence,
  putGloveAwaySequence,
} from './window-release.mjs';
import { setTextCursor, printNumber } from './window-text.mjs';
import { printText } from './text-print.mjs';
import { decimalNumber } from './decimal-number.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { equipmentRows } from './equipment-window.mjs';
import { memberPortrait } from './member-portrait.mjs';
import { closeDialog, clearFixedColourInPlace } from './dialog-screen.mjs';
import { sendApuCommandInPlace } from '../apu/audio-routines.mjs';
import { chooseFromMenu, MENU } from './menu-choice.mjs';
import { itemMenu, ITEM_ENTRIES } from './item-menu.mjs';
import { spellMenu, STATUS_ENTRY } from './member-spell-menu.mjs';
import { skills, notes } from './status-submenus.mjs';
import { taskStop } from '../system/task-stop.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import { STATUS_LAYOUT } from '../data/native-member-spell-menu.mjs';
import {
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
  DP_CURSOR_ROW,
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
  GLOVE_TARGET_OBJECT,
  GLOVE_TARGET_TAG,
  KARMA,
  NUYEN,
  PLAYER_OBJECT,
  WRAM,
} from '../data/wram.mjs';
import { JAKE_ALTERNATE_PORTRAIT_DIALOG, JAKE_OBJECT_NUMBER } from '../data/runners.mjs';
import { STATE_COUNT } from '../data/actors.mjs';
import { APU_COMMAND_VOLUME_TARGET } from '../constants/sound-commands.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { objectWord } from '../state/objects.mjs';

// The entries: the script native, Start and Y in the player control.
export const NATIVE_ENTRY = 0x80ea6e,
  START_ENTRY = 0x80ea89,
  ITEMS_ENTRY = 0x80ea8e;
const SKILLS_MENU = 0x80e834,
  NOTES_MENU = 0x80e8c8;
// The submenus the jump table 80:ED2E (JMP (ED2E,X) at 80:ECEA) may name.
export const STATUS_SUBMENUS = Object.freeze([
  ...Object.keys(ITEM_ENTRIES).map(Number),
  STATUS_ENTRY,
  SKILLS_MENU,
  NOTES_MENU,
]);
// The attribute labels follow the rows; the attributes from index 6 down, the record's
// byte after the third attribute is skipped; the submenus' jump table; the restored
// sound level; the mark set; the first submenu (items) for 1F64.
const SUBMENUS = 0xed2e,
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

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const negative = (value) => (value & WORD_SIGN) !== 0;
// A long word read: WRAM fields indexed past their bank reach the next one.
const longWord = (mem, address) => mem.read16(address & LONG_MASK);

// 80:EA6E, 80:EA89 or 80:EA8E: the status screen (see above) for lifted callers, without
// the JSR frame (the caller's return word lies only in free stack bytes).
export function* statusScreen(h, events, entry = NATIVE_ENTRY, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem,
    native = entry === NATIVE_ENTRY;
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
    const at = objectWord(mem, 'record', object);
    memberMenuState(mem).health = longWord(mem, WRAM + STATE_COUNT + at) & BYTE_MASK;
  };
  // Whether the object's number is in the group (searched from the group's index down).
  const inGroup = (object) => {
    const objectNumber = objectWord(mem, 'number', object);
    for (let at = partyState(mem).lastIndex; !negative(at); at = (at - 2) & WORD_MASK)
      if (partyState(mem).member(at / 2).number === objectNumber) return true;
    return false;
  };

  yield () => {
    memberMenuState(mem).itemsAtOnce = entry === ITEMS_ENTRY ? MARK_SET : 0;
  };
  yield () => sendApuCommandInPlace(h, APU_COMMAND_VOLUME_TARGET, STATUS_VOLUME_TARGET);
  // The native keeps its object DP 00 over the release (PEI, PLY in the original).
  let object;
  yield () => {
    memberMenuState(mem).active = MARK_SET;
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
    const number = objectWord(mem, 'number', object);
    memberMenuState(mem).runnerIndex = findRunnerIndex(mem, number);
    memberMenuState(mem).number = number;
    memberMenuState(mem).object = object;
  };
  yield* putGloveAwaySequence(h, events);
  yield () => clearFixedColourInPlace(h);
  yield () => {
    const state = memberMenuState(mem),
      details = state.details;
    state.recordPosition = 0;
    state.portrait =
      state.runnerIndex === 0 && jakeState(mem).alternatePortrait
        ? JAKE_ALTERNATE_PORTRAIT_DIALOG
        : details.portrait;
    state.datajack = details.datajack ? WORD_MASK : 0;
    memberMenuState(mem).endWord = 0;
    setWord(wram, DP_WINDOW_LEFT, STATUS_WINDOW_SHAPE.left);
    setWord(wram, DP_WINDOW_TOP, STATUS_WINDOW_SHAPE.top);
    setWord(wram, DP_WINDOW_COLUMNS, STATUS_WINDOW_SHAPE.columns);
    setWord(wram, DP_WINDOW_ROWS, STATUS_WINDOW_SHAPE.rows);
    setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
  };
  yield* openWindow(h, events);
  yield () => {
    memberMenuState(mem).window = word(wram, 0);
    const doubled = memberMenuState(mem).stats.magic << 1;
    setWord(wram, DP_MAGIC_MAXIMUM, (doubled << MAGIC_SCALE_SHIFT) + doubled);
  };
  for (const attribute of memberMenuContent(mem).attributes) {
    yield () => {
      setWord(wram, 2, STATUS_ROWS.labelColumn);
      setWord(wram, DP_CURSOR_ROW, attribute.row);
    };
    yield* segmentSequence(() => setTextCursor(h));
    yield* text(attribute.text);
    yield* cursor(STATUS_LAYOUT.valueColumn);
    yield* number(() => {
      const state = memberMenuState(mem),
        value = state.stats[attribute.field];
      state.recordPosition += attribute.field === 'strength' ? 2 : 1;
      return value;
    });
  }
  yield* cursor(STATUS_ROWS.countColumn, STATUS_ROWS.stateCountRow);
  yield* number(() => memberMenuState(mem).health);
  yield* text(TEXT_SLASH);
  yield* number(() => {
    const state = memberMenuState(mem),
      value = state.stats.maxHealth;
    state.recordPosition++;
    return value;
  });
  yield* cursor(STATUS_ROWS.countColumn, STATUS_ROWS.magicRow);
  yield* number(() => memberMenuState(mem).resources.magicPoints);
  yield* text(TEXT_SLASH);
  yield* number(() => word(wram, DP_MAGIC_MAXIMUM));
  let jake;
  yield () => {
    jake = memberMenuState(mem).number === JAKE_OBJECT_NUMBER;
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
    yield* decimalNumber(h, events, renderBuffer);
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
    direct = memberMenuState(mem).itemsAtOnce !== 0;
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
    yield () => (memberMenuState(mem).menuWindow = word(wram, 0));
  }
  for (;;) {
    let chosen, close;
    yield () => {
      if (direct) {
        chosen = FIRST_SUBMENU;
        return;
      }
      close = memberMenuState(mem).itemsAtOnce !== 0;
      if (close) return;
      setWord(wram, 0, memberMenuState(mem).menuWindow);
      setWord(wram, DP_MENU_COLUMN, MENU_COLUMN);
      setWord(wram, DP_MENU_ROW, 0);
      setWord(wram, DP_MENU_VISIBLE_ROWS, MENU_WINDOW.visibleRows);
      setWord(wram, DP_LIST_TOKENS, STATUS_MENU_ITEMS);
      setWord(wram, DP_LIST_TOKEN_BANK, CODE_BANK);
    };
    if (close) return yield* closeSequence(h, events);
    if (!direct) {
      yield* chooseFromMenu(h, events, renderBuffer, MENU);
      yield () => {
        chosen = word(wram, 0);
      };
      if (chosen === 0 || negative(chosen)) break;
    }
    direct = false;
    let submenuSequence;
    yield () => {
      const offset = (chosen << 1) & WORD_MASK;
      const submenu = CODE_BANK_BASE | dataBankWord(mem, SUBMENUS, offset);
      if (Object.hasOwn(ITEM_ENTRIES, submenu))
        submenuSequence = itemMenu(h, events, submenu, renderBuffer);
      else if (submenu === STATUS_ENTRY)
        submenuSequence = spellMenu(h, events, STATUS_ENTRY, renderBuffer);
      else if (submenu === SKILLS_MENU) submenuSequence = skills(h, events, renderBuffer);
      else if (submenu === NOTES_MENU) submenuSequence = notes(h, events, renderBuffer);
      else taskStop('task_ea6e_submenu_open', { pc: 0x80ecea, x: offset, target: submenu });
    };
    // JSR ECEA, whose JMP (ED2E,X) runs the submenu; the lifted submenus run without the
    // JSR frame.
    yield* submenuSequence;
    let ended;
    yield () => {
      ended = memberMenuState(mem).endWord !== 0;
    };
    if (ended) break;
  }
  yield () => setWord(wram, 0, memberMenuState(mem).menuWindow);
  yield* releaseWindowSequence(h, events);
  return yield* closeSequence(h, events);
}
// The status screen as called with JSR (or as the script native); returns with its RTS.
export function* statusScreenSequence(
  h,
  events,
  entry = NATIVE_ENTRY,
  renderBuffer = drawTextBuffer,
) {
  yield* statusScreen(h, events, entry, renderBuffer);
}

// ECF5: the cleanup, the status window released, the mark cleared and the sound
// restored (the RTS follows in statusScreenSequence).
function* closeSequence(h, events) {
  const { mem } = h.a,
    { wram } = mem;
  yield* closeDialog(h, events);
  yield () => setWord(wram, 0, memberMenuState(mem).window);
  yield* releaseWindowSequence(h, events);
  yield () => {
    memberMenuState(mem).active = 0;
  };
  yield () => sendApuCommandInPlace(h, APU_COMMAND_VOLUME_TARGET, FULL_VOLUME);
}
