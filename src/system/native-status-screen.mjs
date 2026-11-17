import { STATUS_LAYOUT } from '../data/native-member-spell-menu.mjs';

import { SKILL_COUNT } from '../data/runners.mjs';

import { languageTextWidth } from '../data/language.mjs';

import { translatedListWindow } from '../data/menu-layout.mjs';

// EA6E dims both sound channels with command 2 and ECF5 restores the full level.
export const STATUS_VOLUME_TARGET = 0x2f2f;

// E4F3 keeps the actor flags and state record across A835.
export const DP_ITEM_FLAGS = 0x2c,
  DP_ITEM_RECORD = 0x29;

// E585 builds the item list from offset 2 (after Exit) in window 0E/0F/0F/08.
export const DP_ITEM_LIST_OFFSET = 0x26;

export const ITEM_WINDOW = Object.freeze({
  left: 0x0e,
  top: 0x0f,
  columns: 0x0f,
  rows: 8,
  visibleRows: 6,
});

// A count byte can need three digits plus the space inserted by A617.
export const ITEM_COUNT_COLUMNS = 3;

// E834: skill names 80:E8BC in window 0D/0C/0F (two rows more than skills), values
// at column 0B.
export const SKILL_NAMES = 0xe8bc,
  SKILL_WINDOW = Object.freeze({ left: 0x0d, top: 0x0c, columns: 0x0f }),
  SKILL_VALUE_COLUMN = 0x0b;

// E8C8: the notes window 11/10/0C; three rows for a runner, four plus one per
// cyberware flag for Jake.
export const NOTES_WINDOW = Object.freeze({
  left: 0x11,
  top: 0x10,
  columns: 0x0c,
  runnerRows: 3,
  jakeRows: 4,
});

export const TEXT_HEAD_COMPUTER = 0x749f,
  TEXT_DATAJACK = 0x05b9,
  TEXT_DERMAL_ARMOUR = 0x7497,
  TEXT_SKILLSOFT = 0x74a7,
  TEXT_WIRED_REFLEXES = 0x74af;

// EA6E: the status window 02/02/1E/1A, the attribute rows ED0E and labels ED16 (word
// index 6 down to 0), the menu window 15/03/08/09 with the seven items ED1E and the
// submenu table ED2E.
export const STATUS_WINDOW_SHAPE = Object.freeze({ left: 2, top: 2, columns: 0x1e, rows: 0x1a });

export const ATTRIBUTE_ROWS = 0xed0e;

export const MENU_WINDOW = Object.freeze({
  left: 0x15,
  top: 3,
  columns: 8,
  rows: 9,
  visibleRows: 7,
});

export const STATUS_MENU_ITEMS = 0xed1e;

// Keep the original right edge while making room for translated labels and
// the selection arrow. FB39 wraps a word when its width equals the space left.
const MENU_TILE_PIXELS = 8,
  MENU_BORDER_COLUMNS = 2,
  MENU_TEXT_COLUMN = 1;

export function translatedMenuWindow(h) {
  if (!h.a.mem?.language) return MENU_WINDOW;
  const ids = [];
  for (let row = 0; row < MENU_WINDOW.visibleRows; row++) {
    ids.push(h.read(0x80ed1e + row * 2));
  }
  return translatedListWindow(h.a.mem, MENU_WINDOW, ids, { column: MENU_TEXT_COLUMN });
}

// The cheat can expose both combat skills. Their German names also need
// room before the separately positioned numeric values.
const SKILL_VALUE_COLUMNS = 2;

const MAX_SKILL_COLUMNS = 30;

export function translatedSkillWindow(h) {
  if (!h.a.mem?.language) return { ...SKILL_WINDOW, valueColumn: SKILL_VALUE_COLUMN };
  let widest = 0;
  for (let slot = 0; slot < SKILL_COUNT; slot++)
    widest = Math.max(widest, languageTextWidth(h.a.mem, h.read(0x80e8bc + slot * 2)) ?? 0);
  const valueColumn = Math.min(
      MAX_SKILL_COLUMNS - SKILL_VALUE_COLUMNS - MENU_BORDER_COLUMNS,
      Math.max(SKILL_VALUE_COLUMN, Math.ceil((widest + 1) / MENU_TILE_PIXELS) + 1),
    ),
    columns = Math.max(
      SKILL_WINDOW.columns,
      valueColumn + SKILL_VALUE_COLUMNS + MENU_BORDER_COLUMNS,
    );
  return {
    ...SKILL_WINDOW,
    valueColumn,
    columns,
    left: Math.max(1, SKILL_WINDOW.left + SKILL_WINDOW.columns - columns),
  };
}

// DP08 keeps 10 x Magic, the maximum of the magic points, until it is printed.
export const DP_MAGIC_MAXIMUM = 8;

// Layout of the status window: label column 1, values at column 0A, the state and
// magic counts at column 0C in rows 0B and 0C, and the rows of Jake's lines.
export const STATUS_ROWS = Object.freeze({
  labelColumn: 1,
  countColumn: 0x0c,
  stateCountRow: 0x0b,
  magicRow: 0x0c,
  karmaRow: 0x10,
  moneyRow: 0x12,
  spellLabelRow: STATUS_LAYOUT.spellRow,
  weaponLabelRow: STATUS_LAYOUT.weaponRow,
  armourLabelRow: STATUS_LAYOUT.armourRow,
});

export const TEXT_SLASH = 0x7110;

export const TEXT_MONEY = 0x7113;
