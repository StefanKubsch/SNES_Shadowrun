import { withInterruptEvents } from './observed-native-events.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import {
  observedContinuation,
  drainNativeSequence,
  dialogCallSequence,
  dialogCallBody,
  nativeTailSequence,
} from './native-call-continuation.mjs';
import { TALK_ROUTINES, validateDialogTaskOptions } from './native-dialog.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import {
  WEAPON_MENU_ROUTINES,
  e693Sequence,
  e4b3Sequence,
  e9c5Sequence,
  DP_SCRATCH,
  STATUS_LAYOUT,
} from './native-member-spell-menu.mjs';
import {
  chooseFromNumberedMenuAdapter,
  requestWindowUploadAdapter,
} from './native-menu-compose.mjs';
import { sendApuCommand } from './native-input-apu.mjs';
import { createObject } from './native-object-create.mjs';
import { drawTextBufferAdapter } from './native-text-compose.mjs';

import {
  DIALOG_END,
  GLOVE_TARGET_TAG,
  GROUP_INDEX,
  GROUP_NUMBERS,
  KARMA,
  MAGIC_POINTS,
  MEMBER_INDEX,
  NUYEN,
  OBJECT_DEPTH_ORDER,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  PAD_PRESSED,
  PLAYER_OBJECT,
  STORY_STAGE,
  WRAM,
  GLOVE_TARGET_OBJECT,
  OBJECT_X,
  OBJECT_Y,
  OBJECT_HEIGHT,
  PAD_SELECT,
  TEXT_BUFFER,
  DP_WINDOW_LEFT,
  DP_WINDOW_TOP,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_MENU_COLUMN,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_LIST_TOKENS,
  DP_LIST_TOKEN_BANK,
  DP_LIST_VALUES,
  DP_CURSOR_ROW,
  DP_OBJECT_KIND,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  DP_OBJECT_HEIGHT,
  DP_OBJECT_SCRIPT,
  DP_MEMBER_RECORD,
  DP_MEMBER_RECORD_BANK,
  STATUS_WINDOW,
  STATUS_MENU_WINDOW,
  STATUS_SUBMENU_WINDOW,
  MEMBER_PORTRAIT,
  MEMBER_DATAJACK,
  MEMBER_PORTRAIT_REDRAW,
  MEMBER_NUMBER,
  MEMBER_OBJECT,
  MEMBER_STATE_COUNT,
  MEMBER_MENU_ACTIVE,
  STATUS_ITEMS_AT_ONCE,
  ITEM_MENU_CLASS,
  MEMBER_MENU_NAMES,
  ITEM_MENU_ACTORS,
  ITEM_MENU_COUNTS,
  JAKE_ALTERNATE_PORTRAIT,
  JAKE_DERMAL_ARMOUR,
  JAKE_SKILLSOFT,
  JAKE_WIRED_REFLEXES,
  NOTICE_WINDOWS,
  NOTICE_WINDOW_LAST,
} from './wram.mjs';
import { BYTE_MASK, BANK_WRAP, WORD_MASK } from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_NEGATIVE,
  FLAG_ZERO,
  FLAG_MEMORY_8BIT,
  FLAG_INDEX_8BIT,
} from '../constants/cpu-flags.mjs';
import { CODE_BANK, CODE_BANK_BASE, WRAM_BANK, WRAM_BANK_PAIR } from '../constants/memory-map.mjs';
import { APU_COMMAND_VOLUME_TARGET } from '../constants/sound-commands.mjs';
import {
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_POINTERS,
  RUNNER_RECORD_BANKS,
  RUNNER_PORTRAITS,
  RUNNER_DATAJACKS,
  RUNNER_LAST_INDEX,
  RECORD_MAGIC,
  SKILL_COUNT,
  JAKE_OBJECT_NUMBER,
  JAKE_ALTERNATE_PORTRAIT_DIALOG,
} from '../data/runners.mjs';
import {
  ACTOR_BYTES,
  ACTOR_DEPTH_FLAGS,
  ACTOR_STAGE_FLAGS,
  LAST_ACTOR,
  STATE_COUNT,
  STATE_HOLDER,
} from '../data/actors.mjs';
import { KIND_ITEM_CLASS_MASK } from '../data/kinds.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { languageTextWidth } from '../data/language.mjs';
import { translatedListWindow, fitListWindow } from '../data/menu-layout.mjs';

// EA6E dims both sound channels with command 2 and ECF5 restores the full level.
export const STATUS_VOLUME_TARGET = 0x2f2f,
  FULL_VOLUME_TARGET = 0x7f7f;
// FDCF: the powers 10^9 down to 10 at FE45 (low words) and FE47 (high words), four bytes
// each; a comma follows the digit of each listed power offset (billions, millions and
// thousands); the text ends with 0D and 0. DP A2/A5 reuse bytes of the FE69 workspace.
const DECIMAL_POWERS_LOW = 0xfe45,
  DECIMAL_POWERS_HIGH = 0xfe47,
  DECIMAL_POWER_BYTES = 4,
  DECIMAL_POWERS_END = 0x21,
  DECIMAL_COMMA_OFFSETS = Object.freeze([4, 0x10, 0x1c]),
  CHARACTER_ZERO = 0x30,
  CHARACTER_COMMA = 0x2c,
  NUMBER_TEXT_LINE_END = 0x0d;
const DP_NUMBER_LOW = 2,
  DP_NUMBER_HIGH = 4,
  DP_REMAINDER_LOW = 0xa2,
  DP_DIGIT_OFFSET = 0xa5;
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
export const ATTRIBUTE_ROWS = 0xed0e,
  ATTRIBUTE_LABELS = 0xed16,
  LAST_ATTRIBUTE_INDEX = 6,
  ATTRIBUTE_SKIPPED_BYTE_INDEX = 2;
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
export const TEXT_MONEY = 0x7113,
  TEXT_KARMA = 0x7117,
  TEXT_SPELL = 0x7484,
  TEXT_WEAPON = 0x7125,
  TEXT_ARMOUR = 0x70b6;
// 80:EA6E (argument DP00 object, no result): show the status screen of a group member. Sound command 2 (81:F007),
// 1F62 = FFFF, FF79; the object (or, while its number is not in the group 7E2DF0, the leader 0CC2; a leader
// outside the group loops for ever: boundary) gives the record byte 7E0002 (1F5E), the weapon index in 9700
// (1F5A/1F5C/1F60), the weapon data [F9] = 971A/9734 and the portrait 974E (Jake with 7E3C17 set: 4F) and 9768
// (1F54/1F56). BCB2 and 81:886A, then the window 02/02/1E/1A (1F4C) with the attribute rows ED0E/ED16, karma,
// ammunition, the counter 7E3C96, Jake's money/karma lines (FDCF prints 7E3C0D/0F as a 32-bit number), E9C5
// and the portrait E4B3. Unless 1F64 is set, the menu ED1E in window 15/03/08/09 (1F4E) chooses a submenu of
// the table ED2E by JMP (ED2E,X) until one sets 1D63; 1F64 set runs the first submenu (E572) at once. At the
// end 92C5, the windows are released and sound command 2 with 7F7F follows.
export const STATUS_SCREEN_ROUTINES = new Map([
  ...WEAPON_MENU_ROUTINES,
  ...[0x8092c5, 0x81886a].map((target) => [target, TALK_ROUTINES.get(target)]),
  [0x80bcb2, TALK_ROUTINES.get(0x80bcb2)],
  [0x81f007, (h) => sendApuCommand(h.a, false)],
  [0x80a6ad, chooseFromNumberedMenuAdapter],
  [0x80fa67, requestWindowUploadAdapter],
  [0x80a835, (h) => createObject(h.a, false)],
  [0x80fb39, drawTextBufferAdapter],
]);
// A table callee with its real frame; registered continuations are chosen by target and function identity.
const access =
  (h, events, routines) =>
  (pc, target, long = false) => {
    if (!routines.get(target)) taskStop('task_ea6e_routine_open', { pc, target });
    return dialogCallSequence(h, events, routines, pc, target, long);
  };
const clc = (h) => {
    h.ctx.status &= ~FLAG_CARRY;
  },
  sec = (h) => {
    h.ctx.status |= FLAG_CARRY;
  };
const store = (h, pairs) => {
  for (const [offset, value] of pairs) {
    h.load(value);
    h.dpWrite(offset, h.ctx.a);
  }
};
// Open notices (7E0216..021C, one nonnegative): F953 and FF79.
function* pendingInput(h, call, pcs) {
  const { ctx } = h;
  h.index('x', NOTICE_WINDOW_LAST);
  for (;;) {
    h.load(h.read(WRAM + NOTICE_WINDOWS + ctx.x));
    if (!(ctx.status & FLAG_NEGATIVE)) {
      yield* call(pcs[0], 0x80f953);
      yield* call(pcs[1], 0x80ff79);
      return;
    }
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
    if (ctx.status & FLAG_NEGATIVE) return;
  }
}

// 80:FDCF: 32-bit number DP04:DP02 as decimal text at 7E21A0 (leading zeros skipped, commas after the
// billions, millions and thousands), last digit, 0D and 0 end; FB39 prints it with DBR 7E.
export function* fdcfSequence(h, events, routines = STATUS_SCREEN_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines);
  h.dpWrite(DP_DIGIT_OFFSET, 0);
  h.index('y', 0);
  do {
    h.index('x', 0);
    for (;;) {
      sec(h);
      h.load(h.dp(DP_NUMBER_LOW));
      h.sbc(h.read(h.abs(DECIMAL_POWERS_LOW) + ctx.y));
      h.dpWrite(DP_REMAINDER_LOW, ctx.a);
      h.load(h.dp(DP_NUMBER_HIGH));
      h.sbc(h.read(h.abs(DECIMAL_POWERS_HIGH) + ctx.y));
      if (!(ctx.status & FLAG_CARRY)) break;
      h.dpWrite(DP_NUMBER_HIGH, ctx.a);
      h.load(h.dp(DP_REMAINDER_LOW));
      h.dpWrite(DP_NUMBER_LOW, ctx.a);
      h.index('x', ctx.x + 1);
    }
    for (let n = 0; n < DECIMAL_POWER_BYTES; n++) h.index('y', ctx.y + 1);
    h.load(ctx.x);
    h.index('x', h.dp(DP_DIGIT_OFFSET));
    let digit = !(ctx.status & FLAG_ZERO);
    if (!digit) {
      h.cmp(0);
      digit = !(ctx.status & FLAG_ZERO);
    }
    if (digit) {
      h.sep(FLAG_MEMORY_8BIT);
      clc(h);
      h.adc(CHARACTER_ZERO);
      h.write(WRAM + TEXT_BUFFER + ctx.x, ctx.a);
      h.index('x', ctx.x + 1);
      let comma = false;
      for (const n of DECIMAL_COMMA_OFFSETS) {
        h.cpy(n);
        if (ctx.status & FLAG_ZERO) {
          comma = true;
          break;
        }
      }
      if (comma) {
        h.load(CHARACTER_COMMA);
        h.write(WRAM + TEXT_BUFFER + ctx.x, ctx.a);
        h.index('x', ctx.x + 1);
      }
      h.rep(FLAG_MEMORY_8BIT);
      h.dpWrite(DP_DIGIT_OFFSET, ctx.x);
    }
    h.cpy(DECIMAL_POWERS_END);
  } while (!(ctx.status & FLAG_CARRY));
  h.phb();
  h.push(WRAM_BANK_PAIR, 2);
  h.plb();
  h.plb();
  h.sep(FLAG_MEMORY_8BIT);
  clc(h);
  h.load(h.dp(DP_NUMBER_LOW, 1));
  h.adc(CHARACTER_ZERO);
  h.write(h.abs(TEXT_BUFFER) + ctx.x, ctx.a);
  h.load(NUMBER_TEXT_LINE_END);
  h.write(h.abs(TEXT_BUFFER + 1) + ctx.x, ctx.a);
  h.write(h.abs(TEXT_BUFFER + 2) + ctx.x, 0);
  h.rep(FLAG_MEMORY_8BIT);
  yield* call(0x80fe40, 0x80fb39);
  h.plb();
  return h.rts();
}
// 80:E4F3: use the item record X: object A835 at a quarter of the position of 1F5C with the record's type
// (8DB022), sprite (8DB024), flags (8DB01F bits 6/7 to 1400) and 8DB020 (13A8); its new task is visited at once
// (C1CA as nested round). Unless 1D63: 1F58 set gives AEB0 and E4B3, an open notice F953/FF79, then E9C5.
export function* e4f3Sequence(h, events, routines = STATUS_SCREEN_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines);
  h.index('y', h.read(h.abs(MEMBER_OBJECT)));
  for (const [table, offset] of [
    [OBJECT_X, DP_OBJECT_X],
    [OBJECT_Y, DP_OBJECT_Y],
    [OBJECT_HEIGHT, DP_OBJECT_HEIGHT],
  ]) {
    h.load(h.read(h.abs(table) + ctx.y));
    h.lsr();
    h.lsr();
    h.dpWrite(offset, ctx.a);
  }
  h.load(h.read(0x8db01f + ctx.x));
  h.load(ctx.a & BYTE_MASK);
  h.dpWrite(DP_ITEM_FLAGS, ctx.a);
  for (const [field, offset] of [
    [0x8db020, DP_ITEM_RECORD],
    [0x8db022, DP_OBJECT_KIND],
    [0x8db024, DP_OBJECT_SCRIPT],
  ]) {
    h.load(h.read(field + ctx.x));
    h.dpWrite(offset, ctx.a);
  }
  h.phx();
  yield* call(0x80e527, 0x80a835);
  h.index('x', h.dp(0));
  h.pla();
  h.write(h.abs(OBJECT_NUMBER) + ctx.x, ctx.a);
  h.load(h.dp(DP_ITEM_FLAGS));
  h.load(ctx.a & ACTOR_DEPTH_FLAGS);
  h.xba();
  h.asl();
  h.adc(0);
  h.write(h.abs(OBJECT_DEPTH_ORDER) + ctx.x, ctx.a);
  h.load(h.dp(DP_ITEM_RECORD));
  h.write(h.abs(OBJECT_RECORD) + ctx.x, ctx.a);
  h.write(h.abs(MEMBER_PORTRAIT_REDRAW), 0);
  yield* call(0x80e545, 0x80c1ca);
  h.load(h.read(h.abs(DIALOG_END)));
  if (ctx.status & FLAG_ZERO) {
    h.load(h.read(h.abs(MEMBER_PORTRAIT_REDRAW)));
    if (!(ctx.status & FLAG_ZERO)) {
      yield* call(0x80e552, 0x81aeb0, true);
      if (routines.has(0x80e4b3)) yield* call(0x80e556, 0x80e4b3);
      else yield* dialogCallBody(h, 0x80e556, 0x80e4b3, () => e4b3Sequence(h, events, routines));
    }
    yield* pendingInput(h, call, [0x80e568, 0x80e56b]);
    if (routines.has(0x80e9c5)) yield* call(0x80e56e, 0x80e9c5);
    else yield* dialogCallBody(h, 0x80e56e, 0x80e9c5, () => e9c5Sequence(h, events, routines));
  }
  return h.rts();
}
// 80:E572/E577/E57F (1F66 = 0/1/2): items of kind 1F66 for the weapon 1F5A. The object records 208A down by 7
// with 8DB01F AND 7E2DE4 AND 7F, a record 8DB020 and the kind 8CEFB4 AND 3 list their names 8CEFB0 in 1DA9
// (header 7088) with the record in 1E2D and the count byte 7E0002 in 1EAF (1 shown as 0); none and 1F64 clear:
// return. Window 0E/0F/0F/08 (1F50, kept between rounds), menu A6AD; FFFF sets 1D63, an item runs E4F3 and,
// unless 1D63, FA67 redraws the window and the list is built again; then FA3E.
export function* e585Sequence(h, events, routines = STATUS_SCREEN_ROUTINES, entry = 0x80e572) {
  const { ctx } = h,
    call = access(h, events, routines);
  if (entry === 0x80e572) h.write(h.abs(ITEM_MENU_CLASS), 0);
  else {
    h.load(entry === 0x80e577 ? 1 : 2);
    h.write(h.abs(ITEM_MENU_CLASS), ctx.a);
  }
  h.load(WORD_MASK);
  h.write(h.abs(STATUS_SUBMENU_WINDOW), ctx.a);
  for (;;) {
    h.load(TEXT_EXIT);
    h.write(h.abs(MEMBER_MENU_NAMES), ctx.a);
    h.write(h.abs(ITEM_MENU_COUNTS), 0);
    h.load(2);
    h.dpWrite(DP_ITEM_LIST_OFFSET, ctx.a);
    h.index('x', LAST_ACTOR);
    do {
      h.index('y', ctx.x);
      list: {
        h.load(h.read(0x8db01f + ctx.x));
        h.load(ctx.a & h.read(WRAM + STORY_STAGE));
        h.load(ctx.a & ACTOR_STAGE_FLAGS);
        if (ctx.status & FLAG_ZERO) break list;
        h.load(h.read(0x8db020 + ctx.x));
        if (ctx.status & FLAG_ZERO) break list;
        h.pha();
        h.load(h.read(0x8db022 + ctx.x));
        h.asl();
        h.dpWrite(2, ctx.a);
        h.asl();
        h.adc(h.dp(2));
        h.index('x', ctx.a);
        h.load(h.read(0x8cefb4 + ctx.x));
        h.plx();
        h.load(ctx.a & KIND_ITEM_CLASS_MASK);
        h.cmp(h.read(h.abs(ITEM_MENU_CLASS)));
        if (!(ctx.status & FLAG_ZERO)) break list;
        h.load(h.read(WRAM + STATE_HOLDER + ctx.x));
        h.cmp(h.read(h.abs(MEMBER_NUMBER)));
        if (!(ctx.status & FLAG_ZERO)) break list;
        h.load(h.read(WRAM + STATE_COUNT + ctx.x));
        h.load(ctx.a & BYTE_MASK);
        h.pha();
        h.index('x', ctx.y);
        h.load(h.read(0x8db022 + ctx.x));
        h.asl();
        h.dpWrite(DP_SCRATCH, ctx.a);
        h.asl();
        h.adc(h.dp(DP_SCRATCH));
        h.index('x', ctx.a);
        h.load(h.read(0x8cefb0 + ctx.x));
        h.index('x', h.dp(DP_ITEM_LIST_OFFSET));
        h.write(h.abs(MEMBER_MENU_NAMES) + ctx.x, ctx.a);
        h.load(ctx.y);
        h.write(h.abs(ITEM_MENU_ACTORS) + ctx.x, ctx.a);
        h.pla();
        h.cmp(1);
        if (ctx.status & FLAG_ZERO) h.load(0);
        h.write(h.abs(ITEM_MENU_COUNTS) + ctx.x, ctx.a);
        h.index('x', ctx.x + 1);
        h.index('x', ctx.x + 1);
        h.dpWrite(DP_ITEM_LIST_OFFSET, ctx.x);
      }
      h.load(ctx.y);
      sec(h);
      h.sbc(ACTOR_BYTES);
      h.index('x', ctx.a);
    } while (!(ctx.status & FLAG_NEGATIVE));
    h.index('x', h.dp(DP_ITEM_LIST_OFFSET));
    h.load(h.read(h.abs(STATUS_ITEMS_AT_ONCE)));
    if (ctx.status & FLAG_ZERO) {
      h.cpx(2);
      if (ctx.status & FLAG_ZERO) return h.rts();
    }
    h.write(h.abs(MEMBER_MENU_NAMES) + ctx.x, 0);
    h.load(h.read(h.abs(STATUS_SUBMENU_WINDOW)));
    if (ctx.status & FLAG_NEGATIVE) {
      let itemWindow = ITEM_WINDOW;
      if (h.a.mem?.language) {
        const ids = [];
        for (let offset = 0; offset < h.dp(DP_ITEM_LIST_OFFSET); offset += 2)
          ids.push(h.read(h.abs(MEMBER_MENU_NAMES) + offset));
        itemWindow = translatedListWindow(h.a.mem, ITEM_WINDOW, ids, {
          valueColumns: ITEM_COUNT_COLUMNS,
        });
      }
      store(h, [
        [DP_WINDOW_LEFT, itemWindow.left],
        [DP_WINDOW_TOP, itemWindow.top],
        [DP_WINDOW_COLUMNS, itemWindow.columns],
        [DP_WINDOW_ROWS, itemWindow.rows],
        [DP_WINDOW_ATTRIBUTES, 0],
      ]);
      yield* call(0x80e638, 0x80f963);
      h.load(h.dp(0));
      h.write(h.abs(STATUS_SUBMENU_WINDOW), ctx.a);
    }
    h.load(1);
    h.dpWrite(DP_MENU_COLUMN, ctx.a);
    h.dpWrite(DP_MENU_ROW, 0);
    store(h, [
      [DP_MENU_VISIBLE_ROWS, ITEM_WINDOW.visibleRows],
      [DP_LIST_TOKENS, MEMBER_MENU_NAMES],
      [DP_LIST_TOKEN_BANK, WRAM_BANK],
      [DP_LIST_VALUES, ITEM_MENU_COUNTS],
    ]);
    yield* call(0x80e65b, 0x80a6ad);
    h.load(h.dp(0));
    h.cmp(WORD_MASK);
    if (ctx.status & FLAG_ZERO) {
      h.write(h.abs(DIALOG_END), ctx.a);
      break;
    }
    h.asl();
    if (ctx.status & FLAG_ZERO) break;
    h.index('x', ctx.a);
    h.load(h.read(h.abs(ITEM_MENU_ACTORS) + ctx.x));
    h.index('x', ctx.a);
    if (routines.has(0x80e4f3)) yield* call(0x80e672, 0x80e4f3);
    else yield* dialogCallBody(h, 0x80e672, 0x80e4f3, () => e4f3Sequence(h, events, routines));
    h.load(h.read(h.abs(DIALOG_END)));
    if (!(ctx.status & FLAG_ZERO)) break;
    h.load(h.read(h.abs(STATUS_SUBMENU_WINDOW)));
    h.dpWrite(0, ctx.a);
    yield* call(0x80e67f, 0x80fa67);
  }
  h.load(h.read(h.abs(STATUS_SUBMENU_WINDOW)));
  h.dpWrite(0, ctx.a);
  yield* call(0x80e68a, 0x80fa3e);
  return h.rts();
}
// 80:E834: the six skill bytes [F9]+0..5 (non-zero ones) with their names E8BC in window 0D/0C/0F (1F50);
// F953, Select (01CE bit 13) sets 1D63 = FFFF; FA3E. No skills: nothing.
export function* e834Sequence(h, events, routines = STATUS_SCREEN_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines),
    skillWindow = translatedSkillWindow(h),
    slot = () => {
      h.load(h.read(h.indirect(DP_MEMBER_RECORD, ctx.y)));
      h.load(ctx.a & BYTE_MASK);
    };
  h.index('x', 0);
  h.index('y', ctx.x);
  do {
    slot();
    if (!(ctx.status & FLAG_ZERO)) h.index('x', ctx.x + 1);
    h.index('y', ctx.y + 1);
    h.cpy(SKILL_COUNT);
  } while (!(ctx.status & FLAG_ZERO));
  h.cpx(0);
  if (ctx.status & FLAG_ZERO) return h.rts();
  h.index('x', ctx.x + 1);
  h.index('x', ctx.x + 1);
  h.dpWrite(DP_WINDOW_ROWS, ctx.x);
  store(h, [
    [DP_WINDOW_LEFT, skillWindow.left],
    [DP_WINDOW_TOP, skillWindow.top],
    [DP_WINDOW_COLUMNS, skillWindow.columns],
    [DP_WINDOW_ATTRIBUTES, 0],
  ]);
  yield* call(0x80e863, 0x80f963);
  h.load(h.dp(0));
  h.write(h.abs(STATUS_SUBMENU_WINDOW), ctx.a);
  h.dpWrite(DP_CURSOR_ROW, 0);
  h.index('y', 0);
  do {
    slot();
    if (!(ctx.status & FLAG_ZERO)) {
      h.phy();
      h.pha();
      h.load(ctx.y);
      h.asl();
      h.index('x', ctx.a);
      h.load(h.read(h.abs(SKILL_NAMES) + ctx.x));
      h.pha();
      h.dpWrite(2, 0);
      yield* call(0x80e882, 0x80faac);
      h.pla();
      h.dpWrite(2, ctx.a);
      yield* call(0x80e888, 0x80fe69);
      store(h, [[2, skillWindow.valueColumn]]);
      yield* call(0x80e890, 0x80faac);
      h.modify(DP_CURSOR_ROW, 'inc', true);
      h.pla();
      h.dpWrite(2, ctx.a);
      yield* call(0x80e898, 0x80fd80);
      h.ply();
    }
    h.index('y', ctx.y + 1);
    h.cpy(SKILL_COUNT);
  } while (!(ctx.status & FLAG_ZERO));
  yield* call(0x80e8a2, 0x80f953);
  h.load(h.read(h.abs(PAD_PRESSED)));
  h.load(ctx.a & PAD_SELECT);
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(WORD_MASK);
    h.write(h.abs(DIALOG_END), ctx.a);
  }
  h.load(h.read(h.abs(STATUS_SUBMENU_WINDOW)));
  h.dpWrite(0, ctx.a);
  yield* call(0x80e8b8, 0x80fa3e);
  return h.rts();
}
// Jake's cyberware notes: flag, text and the FAAC/FE69 call sites.
const CYBERWARE_NOTES = Object.freeze([
  [WRAM + JAKE_DERMAL_ARMOUR, TEXT_DERMAL_ARMOUR, [0x80e966, 0x80e96e]],
  [WRAM + JAKE_SKILLSOFT, TEXT_SKILLSOFT, [0x80e97e, 0x80e986]],
  [WRAM + JAKE_WIRED_REFLEXES, TEXT_WIRED_REFLEXES, [0x80e996, 0x80e99e]],
]);
// 80:E8C8: notes. Not Jake (1F5A not 08B2): with 1F56 a window 11/10/0C/03 with text 05B9. Jake: window
// 11/10/0C with 4 + one row per flag 7E3C18/7E3C05/7E3C19, texts 749F, 05B9 and 7497/74A7/74AF. F953, FA3E.
export function* e8c8Sequence(h, events, routines = STATUS_SCREEN_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines),
    flag = (address) => {
      h.load(h.read(address));
      h.load(ctx.a & BYTE_MASK);
      return !(ctx.status & FLAG_ZERO);
    };
  h.load(h.read(h.abs(MEMBER_NUMBER)));
  h.cmp(JAKE_OBJECT_NUMBER);
  if (!(ctx.status & FLAG_ZERO)) {
    h.load(h.read(h.abs(MEMBER_DATAJACK)));
    if (ctx.status & FLAG_ZERO) return h.rts();
    store(h, [
      [DP_WINDOW_LEFT, NOTES_WINDOW.left],
      [DP_WINDOW_TOP, NOTES_WINDOW.top],
      [DP_WINDOW_COLUMNS, NOTES_WINDOW.columns],
      [DP_WINDOW_ROWS, NOTES_WINDOW.runnerRows],
      [DP_WINDOW_ATTRIBUTES, 0],
    ]);
    fitListWindow(h.a.mem, h, [TEXT_DATAJACK], { column: 0 });
    yield* call(0x80e8ee, 0x80f963);
    store(h, [[2, TEXT_DATAJACK]]);
    yield* call(0x80e8f6, 0x80fe69);
    yield* call(0x80e8f9, 0x80f953);
    yield* call(0x80e8fc, 0x80fa3e);
    return h.rts();
  }
  h.index('x', NOTES_WINDOW.jakeRows);
  for (const [address] of CYBERWARE_NOTES) if (flag(address)) h.index('x', ctx.x + 1);
  h.dpWrite(DP_WINDOW_ROWS, ctx.x);
  store(h, [
    [DP_WINDOW_LEFT, NOTES_WINDOW.left],
    [DP_WINDOW_TOP, NOTES_WINDOW.top],
    [DP_WINDOW_COLUMNS, NOTES_WINDOW.columns],
    [DP_WINDOW_ATTRIBUTES, 0],
  ]);
  fitListWindow(
    h.a.mem,
    h,
    [TEXT_HEAD_COMPUTER, TEXT_DATAJACK, ...CYBERWARE_NOTES.map(([, id]) => id)],
    {
      column: 0,
    },
  );
  yield* call(0x80e937, 0x80f963);
  store(h, [[2, TEXT_HEAD_COMPUTER]]);
  yield* call(0x80e93f, 0x80fe69);
  h.dpWrite(2, 0);
  store(h, [[DP_CURSOR_ROW, 1]]);
  yield* call(0x80e949, 0x80faac);
  store(h, [[2, TEXT_DATAJACK]]);
  yield* call(0x80e951, 0x80fe69);
  store(h, [[DP_CURSOR_ROW, 1]]);
  for (const [address, text, pcs] of CYBERWARE_NOTES) {
    if (!flag(address)) continue;
    h.dpWrite(2, 0);
    h.modify(DP_CURSOR_ROW, 'inc', true);
    yield* call(pcs[0], 0x80faac);
    store(h, [[2, text]]);
    yield* call(pcs[1], 0x80fe69);
  }
  yield* call(0x80e9a1, 0x80f953);
  yield* call(0x80e9a4, 0x80fa3e);
  return h.rts();
}
// JMP (ED2E,X) at ECEA: the submenus of the status screen.
export const SUBMENU_SEQUENCES = new Map([
  [0xe572, (h, e, r) => e585Sequence(h, e, r, 0x80e572)],
  [0xe577, (h, e, r) => e585Sequence(h, e, r, 0x80e577)],
  [0xe57f, (h, e, r) => e585Sequence(h, e, r, 0x80e57f)],
  [0xe68e, (h, e, r) => e693Sequence(h, e, r, 0x80e68e)],
  [0xe834, e834Sequence],
  [0xe8c8, e8c8Sequence],
]);
function* submenuSequence(h, events, routines) {
  const { ctx } = h,
    target = h.read(0x80ed2e + ctx.x);
  // A submenu in the routine table takes over the frame of the JSR to ECEA.
  if (routines.has(CODE_BANK_BASE | target))
    return yield* nativeTailSequence(h, events, routines, CODE_BANK_BASE | target);
  const run = SUBMENU_SEQUENCES.get(target);
  if (!run) taskStop('task_ea6e_submenu_open', { pc: 0x80ecea, x: ctx.x, target });
  ctx.pc = target;
  return yield* run(h, events, routines);
}
// Entries of the status screen: EA6E (Native B0, object DP00 kept over FF79 by PEI/PLY), EA89 (Start in E014,
// 1F64 = 0) and EA8E (Y in E014, 1F64 = FFFF: the item submenu at once); both take the object under the glove
// (01DA not negative: 01DE) or the leader 0CC2.
function* statusSequence(h, events, routines = STATUS_SCREEN_ROUTINES, entry = 0x80ea6e) {
  const { ctx } = h,
    call = access(h, events, routines);
  if (entry === 0x80ea8e) {
    h.load(WORD_MASK);
    h.write(h.abs(STATUS_ITEMS_AT_ONCE), ctx.a);
  } else h.write(h.abs(STATUS_ITEMS_AT_ONCE), 0);
  const native = entry === 0x80ea6e;
  h.load(APU_COMMAND_VOLUME_TARGET);
  h.index('x', STATUS_VOLUME_TARGET);
  yield* call(native ? 0x80ea77 : 0x80ea9a, 0x81f007, true);
  h.load(WORD_MASK);
  h.write(h.abs(MEMBER_MENU_ACTIVE), ctx.a);
  if (native) {
    h.push(h.dp(0), 2);
    yield* call(0x80ea83, 0x80ff79);
    h.ply();
  } else {
    yield* call(0x80eaa4, 0x80ff79);
    h.load(h.read(h.abs(GLOVE_TARGET_TAG)));
    h.index('y', h.read(h.abs(ctx.status & FLAG_NEGATIVE ? PLAYER_OBJECT : GLOVE_TARGET_OBJECT)));
  }
  h.index('x', h.read(h.abs(OBJECT_RECORD) + ctx.y));
  h.load(h.read(WRAM + STATE_COUNT + ctx.x));
  h.load(ctx.a & BYTE_MASK);
  h.write(h.abs(MEMBER_STATE_COUNT), ctx.a);
  for (let leader = false; ; leader = true) {
    h.load(h.read(WRAM + GROUP_INDEX));
    h.index('x', ctx.a);
    h.load(h.read(h.abs(OBJECT_NUMBER) + ctx.y));
    for (;;) {
      h.cmp(h.read(WRAM + GROUP_NUMBERS + ctx.x));
      if (ctx.status & FLAG_ZERO) break;
      h.index('x', ctx.x - 1);
      h.index('x', ctx.x - 1);
      if (ctx.status & FLAG_NEGATIVE) break;
    }
    if (ctx.status & FLAG_ZERO) break;
    if (leader) taskStop('task_ea6e_endless_search');
    h.index('y', h.read(h.abs(PLAYER_OBJECT)));
    h.index('x', h.read(h.abs(OBJECT_RECORD) + ctx.y));
    h.load(h.read(WRAM + STATE_COUNT + ctx.x));
    h.load(ctx.a & BYTE_MASK);
    h.write(h.abs(MEMBER_STATE_COUNT), ctx.a);
  }
  h.index('x', RUNNER_LAST_INDEX);
  for (;;) {
    h.cmp(h.read(h.abs(RUNNER_OBJECT_NUMBERS) + ctx.x));
    if (ctx.status & FLAG_ZERO) break;
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
    if (ctx.status & FLAG_NEGATIVE) break;
  }
  h.write(h.abs(MEMBER_NUMBER), ctx.a);
  h.write(h.abs(MEMBER_OBJECT), ctx.y);
  h.write(h.abs(MEMBER_INDEX), ctx.x);
  yield* call(0x80eaea, 0x80bcb2);
  yield* call(0x80eaed, 0x81886a, true);
  h.index('x', h.read(h.abs(MEMBER_INDEX)));
  h.load(h.read(h.abs(RUNNER_RECORD_POINTERS) + ctx.x));
  h.dpWrite(DP_MEMBER_RECORD, ctx.a);
  let jake = false;
  h.cpx(0);
  if (ctx.status & FLAG_ZERO) {
    h.load(h.read(WRAM + JAKE_ALTERNATE_PORTRAIT));
    h.load(ctx.a & BYTE_MASK);
    jake = !(ctx.status & FLAG_ZERO);
  }
  if (jake) h.load(JAKE_ALTERNATE_PORTRAIT_DIALOG);
  else h.load(h.read(h.abs(RUNNER_PORTRAITS) + ctx.x));
  h.write(h.abs(MEMBER_PORTRAIT), ctx.a);
  h.load(h.read(h.abs(RUNNER_DATAJACKS) + ctx.x));
  h.write(h.abs(MEMBER_DATAJACK), ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(RUNNER_RECORD_BANKS) + ctx.x));
  h.dpWrite(DP_MEMBER_RECORD_BANK, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.write(h.abs(DIALOG_END), 0);
  store(h, [
    [DP_WINDOW_LEFT, STATUS_WINDOW_SHAPE.left],
    [DP_WINDOW_TOP, STATUS_WINDOW_SHAPE.top],
    [DP_WINDOW_COLUMNS, STATUS_WINDOW_SHAPE.columns],
    [DP_WINDOW_ROWS, STATUS_WINDOW_SHAPE.rows],
    [DP_WINDOW_ATTRIBUTES, 0],
  ]);
  yield* call(0x80eb3a, 0x80f963);
  h.load(h.dp(0));
  h.write(h.abs(STATUS_WINDOW), ctx.a);
  h.index('y', RECORD_MAGIC);
  h.load(h.read(h.indirect(DP_MEMBER_RECORD, ctx.y)));
  h.load(ctx.a & BYTE_MASK);
  h.asl();
  h.dpWrite(DP_MAGIC_MAXIMUM, ctx.a);
  h.asl();
  h.asl();
  h.adc(h.dp(DP_MAGIC_MAXIMUM));
  h.dpWrite(DP_MAGIC_MAXIMUM, ctx.a);
  h.index('x', LAST_ATTRIBUTE_INDEX);
  do {
    store(h, [[2, STATUS_ROWS.labelColumn]]);
    h.load(h.read(h.abs(ATTRIBUTE_ROWS) + ctx.x));
    h.dpWrite(DP_CURSOR_ROW, ctx.a);
    h.dpWrite(DP_SCRATCH, ctx.x);
    yield* call(0x80eb62, 0x80faac);
    h.index('x', h.dp(DP_SCRATCH));
    h.load(h.read(h.abs(ATTRIBUTE_LABELS) + ctx.x));
    h.dpWrite(2, ctx.a);
    yield* call(0x80eb6c, 0x80fe69);
    store(h, [[2, STATUS_LAYOUT.valueColumn]]);
    yield* call(0x80eb74, 0x80faac);
    h.load(h.read(h.indirect(DP_MEMBER_RECORD)));
    h.modify(DP_MEMBER_RECORD, 'inc', true);
    h.index('x', h.dp(DP_SCRATCH));
    h.cpx(ATTRIBUTE_SKIPPED_BYTE_INDEX);
    if (ctx.status & FLAG_ZERO) h.modify(DP_MEMBER_RECORD, 'inc', true);
    h.load(ctx.a & BYTE_MASK);
    h.dpWrite(2, ctx.a);
    yield* call(0x80eb89, 0x80fd80);
    h.index('x', h.dp(DP_SCRATCH));
    h.index('x', ctx.x - 1);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  store(h, [
    [2, STATUS_ROWS.countColumn],
    [DP_CURSOR_ROW, STATUS_ROWS.stateCountRow],
  ]);
  yield* call(0x80eb9c, 0x80faac);
  h.load(h.read(h.abs(MEMBER_STATE_COUNT)));
  h.dpWrite(2, ctx.a);
  yield* call(0x80eba4, 0x80fd80);
  store(h, [[2, TEXT_SLASH]]);
  yield* call(0x80ebac, 0x80fe69);
  h.load(h.read(h.indirect(DP_MEMBER_RECORD)));
  h.modify(DP_MEMBER_RECORD, 'inc', true);
  h.load(ctx.a & BYTE_MASK);
  h.dpWrite(2, ctx.a);
  yield* call(0x80ebb8, 0x80fd80);
  store(h, [
    [2, STATUS_ROWS.countColumn],
    [DP_CURSOR_ROW, STATUS_ROWS.magicRow],
  ]);
  yield* call(0x80ebc5, 0x80faac);
  h.load(h.read(h.abs(MEMBER_INDEX)));
  h.lsr();
  h.index('x', ctx.a);
  h.load(h.read(WRAM + MAGIC_POINTS + ctx.x));
  h.load(ctx.a & BYTE_MASK);
  h.dpWrite(2, ctx.a);
  yield* call(0x80ebd6, 0x80fd80);
  store(h, [[2, TEXT_SLASH]]);
  yield* call(0x80ebde, 0x80fe69);
  h.load(h.dp(DP_MAGIC_MAXIMUM));
  h.dpWrite(2, ctx.a);
  yield* call(0x80ebe5, 0x80fd80);
  h.load(h.read(h.abs(MEMBER_NUMBER)));
  h.cmp(JAKE_OBJECT_NUMBER);
  if (ctx.status & FLAG_ZERO) {
    store(h, [
      [2, STATUS_ROWS.labelColumn],
      [DP_CURSOR_ROW, STATUS_ROWS.karmaRow],
    ]);
    yield* call(0x80ebfa, 0x80faac);
    store(h, [[2, TEXT_KARMA]]);
    yield* call(0x80ec02, 0x80fe69);
    store(h, [[2, STATUS_LAYOUT.valueColumn]]);
    yield* call(0x80ec0a, 0x80faac);
    h.load(h.read(WRAM + KARMA));
    h.lsr();
    h.lsr();
    h.lsr();
    h.dpWrite(2, ctx.a);
    yield* call(0x80ec16, 0x80fd80);
    store(h, [
      [2, STATUS_ROWS.labelColumn],
      [DP_CURSOR_ROW, STATUS_ROWS.moneyRow],
    ]);
    yield* call(0x80ec23, 0x80faac);
    store(h, [[2, TEXT_MONEY]]);
    yield* call(0x80ec2b, 0x80fe69);
    store(h, [[2, STATUS_LAYOUT.valueColumn]]);
    yield* call(0x80ec33, 0x80faac);
    h.load(h.read(WRAM + NUYEN));
    h.dpWrite(DP_NUMBER_LOW, ctx.a);
    h.load(h.read(WRAM + NUYEN + 2));
    h.dpWrite(DP_NUMBER_HIGH, ctx.a);
    if (routines.has(0x80fdcf)) yield* call(0x80ec42, 0x80fdcf);
    else yield* dialogCallBody(h, 0x80ec42, 0x80fdcf, () => fdcfSequence(h, events, routines));
    store(h, [
      [2, STATUS_ROWS.labelColumn],
      [DP_CURSOR_ROW, STATUS_ROWS.spellLabelRow],
    ]);
    yield* call(0x80ec4f, 0x80faac);
    store(h, [[2, TEXT_SPELL]]);
    yield* call(0x80ec57, 0x80fe69);
  }
  store(h, [
    [2, STATUS_ROWS.labelColumn],
    [DP_CURSOR_ROW, STATUS_ROWS.weaponLabelRow],
  ]);
  yield* call(0x80ec64, 0x80faac);
  store(h, [[2, TEXT_WEAPON]]);
  yield* call(0x80ec6c, 0x80fe69);
  store(h, [
    [2, STATUS_ROWS.labelColumn],
    [DP_CURSOR_ROW, STATUS_ROWS.armourLabelRow],
  ]);
  yield* call(0x80ec79, 0x80faac);
  store(h, [[2, TEXT_ARMOUR]]);
  yield* call(0x80ec81, 0x80fe69);
  // The equipment rows and the portrait from the table when present (the lifted ones).
  if (routines.has(0x80e9c5)) yield* call(0x80ec84, 0x80e9c5);
  else yield* dialogCallBody(h, 0x80ec84, 0x80e9c5, () => e9c5Sequence(h, events, routines));
  if (routines.has(0x80e4b3)) yield* call(0x80ec87, 0x80e4b3);
  else yield* dialogCallBody(h, 0x80ec87, 0x80e4b3, () => e4b3Sequence(h, events, routines));
  // EC8A: 1F64 set chooses submenu 1 at once (ECDB), else the menu window 15/03/08/09 opens (1F4E). ECB0: 1F64 set
  // ends without releasing 1F4E; the menu ED1E (7 rows) gives 0/negative (release 1F4E) or a submenu
  // JSR ECEA = JMP (ED2E,2n); after it 1D63 clear repeats at ECB0, set releases 1F4E.
  let direct = false;
  h.load(h.read(h.abs(STATUS_ITEMS_AT_ONCE)));
  if (!(ctx.status & FLAG_ZERO)) direct = true;
  else {
    const menuWindow = translatedMenuWindow(h);
    store(h, [
      [DP_WINDOW_LEFT, menuWindow.left],
      [DP_WINDOW_TOP, menuWindow.top],
      [DP_WINDOW_COLUMNS, menuWindow.columns],
      [DP_WINDOW_ROWS, menuWindow.rows],
      [DP_WINDOW_ATTRIBUTES, 0],
    ]);
    yield* call(0x80eca8, 0x80f963);
    h.load(h.dp(0));
    h.write(h.abs(STATUS_MENU_WINDOW), ctx.a);
  }
  for (;;) {
    if (direct) {
      h.load(1);
      direct = false;
    } else {
      h.load(h.read(h.abs(STATUS_ITEMS_AT_ONCE)));
      if (!(ctx.status & FLAG_ZERO)) return yield* closeStatus(h, call);
      h.load(h.read(h.abs(STATUS_MENU_WINDOW)));
      h.dpWrite(0, ctx.a);
      store(h, [[DP_MENU_COLUMN, 1]]);
      h.dpWrite(DP_MENU_ROW, 0);
      store(h, [
        [DP_MENU_VISIBLE_ROWS, MENU_WINDOW.visibleRows],
        [DP_LIST_TOKENS, STATUS_MENU_ITEMS],
        [DP_LIST_TOKEN_BANK, CODE_BANK],
      ]);
      yield* call(0x80ecd0, 0x80a6c7);
      h.load(h.dp(0));
      if (ctx.status & (FLAG_ZERO | FLAG_NEGATIVE)) break;
    }
    h.asl();
    h.index('x', ctx.a);
    yield* dialogCallBody(h, 0x80ece0, 0x80ecea, () => submenuSequence(h, events, routines));
    h.load(h.read(h.abs(DIALOG_END)));
    if (!(ctx.status & FLAG_ZERO)) break;
  }
  h.load(h.read(h.abs(STATUS_MENU_WINDOW)));
  h.dpWrite(0, ctx.a);
  yield* call(0x80ecf2, 0x80fa3e);
  return yield* closeStatus(h, call);
}
// ECF5: 92C5, release 1F4C, 1F62 = 0, sound command 2 with 7F7F.
function* closeStatus(h, call) {
  const { ctx } = h;
  yield* call(0x80ecf5, 0x8092c5);
  h.load(h.read(h.abs(STATUS_WINDOW)));
  h.dpWrite(0, ctx.a);
  yield* call(0x80ecfd, 0x80fa3e);
  h.write(h.abs(MEMBER_MENU_ACTIVE), 0);
  h.load(APU_COMMAND_VOLUME_TARGET);
  h.index('x', FULL_VOLUME_TARGET);
  yield* call(0x80ed09, 0x81f007, true);
}
// The status screen as a routine with its RTS (E014: JSR EA89/EA8E).
export function* statusRoutineSequence(h, events, routines, entry) {
  yield* statusSequence(h, events, routines, entry);
  return h.rts();
}
export function showStatusScreen(a, events, outerReturn = true, routines = STATUS_SCREEN_ROUTINES) {
  return drainNativeSequence(showStatusScreenSequence(a, events, outerReturn, routines));
}
function* showStatusScreenSequence(a, events, outerReturn, routines = STATUS_SCREEN_ROUTINES) {
  if (
    a.ctx.d !== 0 ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_ea6e_entry_required');
  const h = dialogAccess(a),
    { ctx } = h;
  yield* statusSequence(h, events, routines, 0x80ea6e);
  const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'EA6E-RTS', outerReturn);
  ctx.s = (ctx.s + 2) & WORD_MASK;
  ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return {
    rawReturnWord,
    returnTarget: CODE_BANK_BASE | ctx.pc,
    returnTargetExecuted: false,
    dynamicDispatchExecuted: false,
    frontier: 'observed-outer-RTS-target',
    scope: 'manual-source-specific-native-ea6e',
  };
}
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits and inputs replay the register-level
// native.
function observeShowStatusScreen(a, options, outerReturn, lifted = null) {
  const invalid = validateDialogTaskOptions(options);
  if (invalid) taskStop(invalid.reason);
  const events = withInterruptEvents(
    {
      mode: 'record-observations',
      values: options?.waitObservations ?? null,
      waitIndex: 0,
      calls: [],
      waitEvents: [],
      inputMode: 'record-observations',
      inputs: options?.inputObservations ?? null,
      inputIndex: 0,
      round: options?.round ?? null,
      nestedRound: options?.nestedRound ?? null,
    },
    options,
  );
  const finish = (result) => {
    if (events.waitIndex !== (events.values?.length ?? 0))
      taskStop('task_wait_observation_unused', { observationIndex: events.waitIndex });
    if (events.inputIndex !== (events.inputs?.length ?? 0))
      taskStop('task_input_observation_unused', { observationIndex: events.inputIndex });
    return {
      ...result,
      waitObservationsUsed: events.waitIndex,
      inputObservationsUsed: events.inputIndex,
    };
  };
  if (lifted !== null && lagFree(events))
    return { sequence: liftedResult(lifted(dialogAccess(a), events)), finish };
  return { sequence: showStatusScreenSequence(a, events, outerReturn), finish };
}
function* liftedResult(sequence) {
  return { rawReturnWord: yield* sequence };
}
export function showStatusScreenObserved(a, options, outerReturn = true, lifted = null) {
  const { sequence, finish } = observeShowStatusScreen(a, options, outerReturn, lifted);
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createShowStatusScreenObserved = (a, options, lifted = null) =>
  observedContinuation(a, observeShowStatusScreen(a, options, false, lifted));
