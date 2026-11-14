import { withInterruptEvents } from './observed-native-events.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import {
  observedContinuation,
  drainNativeSequence,
  dialogCallSequence,
  dialogCallBody,
  NATIVE_CALL_CONTINUATIONS,
} from './native-call-continuation.mjs';
import { TALK_ROUTINES, validateDialogTaskOptions } from './native-dialog.mjs';
import {
  uploadPortraitTiles,
  PORTRAIT_WINDOW,
  PORTRAIT_OBJSEL,
  DP_PORTRAIT_POINTER,
  DP_PORTRAIT_BANK,
  PORTRAIT_RECORD_BANK_BYTE,
  PORTRAIT_BUFFER,
  SECOND_PORTRAIT_PALETTE,
  SECOND_PORTRAIT_VRAM,
  SECOND_PORTRAIT_HDMA,
} from './native-dialog-portrait.mjs';
import { resetAndDrawWindowList } from './native-glove-target.mjs';
import { chooseFromMenuAdapter } from './native-menu-compose.mjs';
import { appendScriptTask } from './task-append.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { waitForConfirmKeyAdapter } from './native-input-wait.mjs';
import { setTextCursor, printNumber } from './native-list-prerequisites.mjs';
import { printTextAdapter } from './native-text-compose.mjs';

import {
  DIALOG_END,
  MEMBER_INDEX,
  NMI_JOB_LISTS,
  OBJECT_NUMBER,
  PLAYER_OBJECT,
  RUNNER_ARMOUR,
  RUNNER_ARMOUR_RATING,
  RUNNER_WEAPON,
  WRAM,
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
  DP_CURSOR_ROW,
  DP_MEMBER_RECORD,
  DP_MEMBER_RECORD_BANK,
  TMW_SHADOW,
  HDMAEN_SHADOW,
  PORTRAIT_PALETTE_START,
  PALETTE_UPLOAD_LIST_BYTES,
  STATUS_WINDOW,
  STATUS_SUBMENU_WINDOW,
  PORTRAIT_HDMA_TABLE,
  PORTRAIT_WINDOW_LEFT,
  PORTRAIT_WINDOW_RIGHT,
  MEMBER_PORTRAIT,
  MEMBER_PORTRAIT_REDRAW,
  MEMBER_NUMBER,
  MEMBER_OBJECT,
  MEMBER_MENU_ACTIVE,
  SPELL_CHOICE_RUNS_SCRIPT,
  MEMBER_MENU_NAMES,
  SPELL_MENU_SCRIPTS,
  SPELL_MENU_LEVELS,
  SPELL_MENU_LEADER_SCRIPTS,
  SPELL_MENU_LEVEL_POINTERS,
  SPELL_MENU_SPELL_NAMES,
  SELECTED_SPELL_SCRIPT,
  SELECTED_SPELL_NAME,
  SELECTED_SPELL_LEVEL_POINTER,
  JAKE_DERMAL_ARMOUR,
  NOTICE_WINDOWS,
  NOTICE_WINDOW_LAST,
} from './wram.mjs';
import {
  W12SEL,
  WBGLOG,
  A1T0L,
  OBJSEL,
  DMAP0,
  BBAD0,
  A1B0,
} from '../constants/hardware-registers.mjs';
import { BYTE_MASK, BANK_WRAP, WORD_MASK, WORD_BITS } from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_ZERO,
  FLAG_INDEX_8BIT,
} from '../constants/cpu-flags.mjs';
import { CODE_BANK, CODE_BANK_BASE, WRAM_BANK } from '../constants/memory-map.mjs';
import {
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_POINTERS,
  RUNNER_RECORD_BANKS,
  RUNNER_LAST_INDEX,
  SKILLS_START,
  SPELLS_START,
  SPELL_COUNT,
} from '../data/runners.mjs';
import { DIALOG_TABLE, DIALOG_BANK_BASE } from '../data/portraits.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { translatedListWindow } from '../data/menu-layout.mjs';

// E433 uses the portrait window values of 80:8F3A (native-dialog-portrait.mjs) with
// the 13-byte table 80:E480 and only the left window's edges (E41F).
const PORTRAIT_HDMA_LAST_BYTE = 0x0c;
// E48D: the second portrait's words as written by 80:905E, without its mirror bit.
const SECOND_PORTRAIT_HDMA_WORDS = Object.freeze([
  [SECOND_PORTRAIT_HDMA.firstAddress, SECOND_PORTRAIT_HDMA.first],
  [SECOND_PORTRAIT_HDMA.secondAddress, SECOND_PORTRAIT_HDMA.second],
  [SECOND_PORTRAIT_HDMA.oamHighAddress, SECOND_PORTRAIT_HDMA.oamHigh],
]);
// Word scratch of the times-six kind index (and of EA6E's row loop).
export const DP_SCRATCH = 0x6b;
// Texts: "none" and a blank field.
export const TEXT_NONE = 0x712e,
  TEXT_BLANK_FIELD = 0x707f;
// E9C5 rows of the status window and their value column; dermal armour adds 2.
export const STATUS_LAYOUT = Object.freeze({
  valueColumn: 0x0a,
  spellRow: 0x14,
  weaponRow: 0x15,
  armourRow: 0x16,
});
const DERMAL_ARMOUR_BONUS = 2;
// E693: spell slots relative to [F9] = record + skills, the spell window 0B/0F/12
// with three rows more than spells and seven visible rows, and the tables of
// src/data/tables.mjs indexed by 2 slot (level names by 12 (level - 1) + 2 slot).
export const SPELL_SLOT_FIRST = SPELLS_START - SKILLS_START,
  SPELL_SLOT_END = SPELL_SLOT_FIRST + SPELL_COUNT,
  SPELL_SLOT_INDEX_BIAS = 2 * SPELL_SLOT_FIRST;
export const SPELL_WINDOW = Object.freeze({
  left: 0x0b,
  top: 0x0f,
  columns: 0x12,
  extraRows: 3,
  visibleRows: 7,
});
// DP04 holds the last written list offset until A6C7 takes it as its row.
const DP_SPELL_LIST_OFFSET = DP_MENU_ROW;
export const SPELL_LEVEL_NAMES = 0xe7c8,
  SPELL_SCRIPTS_A = 0xe810,
  SPELL_SCRIPTS_B = 0xe81c,
  SPELL_NAMES = 0xe828;
// 80:F254 (argument DP00 object, result DP00): open the weapon menu of the object. The item number 150A+Y is
// searched in 9700 (X from 18 down by 2, without a match FFFE); 1F5A/1F5C/1F60 keep number, object and
// index, [F9] = 971A+6/9734 points to the weapon data. 1F62 is FFFF during the menu. E693 lists the
// non-zero slots [F9]+6..B in the menu A6C7 (window 0B/0F/12 over F963, entries 1DA9 with header 7088,
// columns 1E2D/1E3D/1E4D/1E5D/1F31 from E804/E810/E81C). A choice of the leader 0CC2 sets 7E3C13/3C1A/
// 3C15; for another object with 1F68 set the script 1E2D is appended (C34A) and visited at once as a nested
// scheduler round (C1CA) like the topic action of the dialog. E9C5 (weapon window text) only runs with
// 1F68 = 0, which E693 itself never leaves (it sets FFFF); E4B3 (portrait over 9F6D/8F20/9022, HDMA E433)
// only after a round that set 1F58.
// Called routines with their own proofs, by target; a routine gets (h, events) and ends with its RTS/RTL.
export const WEAPON_MENU_ROUTINES = new Map([
  ...[0x80f963, 0x80fa3e, 0x80ff79, 0x809f6d, 0x808f20, 0x809022, 0x81b0a1].map((target) => [
    target,
    TALK_ROUTINES.get(target),
  ]),
  [0x80a6c7, chooseFromMenuAdapter],
  [0x80c34a, (h) => appendScriptTask(h.a, false)],
  // JSR $C1CA: visit of the new head task as a nested scheduler round (VM: NativeCalls.round).
  [
    0x80c1ca,
    (h, e) => {
      if (!e.round)
        taskStop('task_f254_visit_open', { pc: 0x80e78e, append: 0x80c34a, visit: 0x80c1ca });
      const more = e.round(0x80c1ca);
      if (more?.wait?.length) e.values = Object.freeze([...(e.values ?? []), ...more.wait]);
      if (more?.input?.length) e.inputs = Object.freeze([...(e.inputs ?? []), ...more.input]);
    },
  ],
  [0x81aeb0, resetAndDrawWindowList],
  [0x80f953, waitForConfirmKeyAdapter],
  [0x808ff5, (h, e) => uploadPortraitTiles(h, e)],
  [0x80faac, (h, e) => setTextCursor(h.a, e, false)],
  [0x80fe69, printTextAdapter],
  [0x80fd80, (h, e) => printNumber(h.a, e, false)],
]);
// In the continuation the visit is its own pausable round (NativeCalls nestedRound), so texts and
// inputs of the visited script pause like any other wait; without it the synchronous round above.
NATIVE_CALL_CONTINUATIONS.set(0x80c1ca, {
  run: WEAPON_MENU_ROUTINES.get(0x80c1ca),
  create: ({ events }) => events.nestedRound?.(0x80c1ca) ?? null,
});
// A table callee with its real frame; registered continuations are chosen by target and function identity.
const access =
  (h, events, routines) =>
  (pc, target, long = false) => {
    if (!routines.get(target)) taskStop('task_f254_routine_open', { pc, target });
    return dialogCallSequence(h, events, routines, pc, target, long);
  };
const clc = (h) => {
  h.ctx.status &= ~FLAG_CARRY;
};
const store = (h, pairs) => {
  for (const [offset, value] of pairs) {
    h.load(value);
    h.dpWrite(offset, h.ctx.a);
  }
};

// 80:E41F (PHP, BYTE-A): 1F44 = X+39, 1F43 = (X EOR FF)+3B+carry.
function setPortraitWindowEdges(h) {
  const { ctx } = h;
  h.php();
  h.sep(FLAG_MEMORY_8BIT);
  h.load(ctx.x);
  clc(h);
  h.adc(PORTRAIT_WINDOW.leftWindowRightBias);
  h.write(h.abs(PORTRAIT_WINDOW_RIGHT), ctx.a);
  h.load(ctx.x);
  h.load(ctx.a ^ BYTE_MASK);
  h.adc(PORTRAIT_WINDOW.leftWindowLeftBias);
  h.write(h.abs(PORTRAIT_WINDOW_LEFT), ctx.a);
  h.plp();
  return h.rts();
}
// 80:E433: color math 2123/212A, HDMA table 1F3F from 80:E480 (13 bytes) on channel 0 (01C4 bit 0,
// 01C2 = 0F), then eleven frames B0A1 with the window edges E41F for X = 2, 5, .., 20.
function* e433Sequence(h, events, routines = WEAPON_MENU_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines);
  h.load(PORTRAIT_WINDOW.select);
  h.portWrite(W12SEL, ctx.a, 2, 0x80e436);
  h.portWrite(WBGLOG, 0, 2, 0x80e439);
  h.load(PORTRAIT_HDMA_TABLE);
  h.portWrite(A1T0L, ctx.a, 2, 0x80e43f);
  h.sep(FLAG_MEMORY_8BIT);
  h.index('x', PORTRAIT_HDMA_LAST_BYTE);
  do {
    h.load(h.read(0x80e480 + ctx.x));
    h.write(h.abs(PORTRAIT_HDMA_TABLE) + ctx.x, ctx.a);
    h.index('x', ctx.x - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  for (const [pc, port, value] of [
    [0x80e453, DMAP0, PORTRAIT_WINDOW.hdmaMode],
    [0x80e458, BBAD0, PORTRAIT_WINDOW.hdmaTarget],
    [0x80e45d, A1B0, WRAM_BANK],
  ]) {
    h.load(value);
    h.portWrite(port, value, 1, pc);
  }
  h.load(PORTRAIT_WINDOW.hdmaChannel);
  h.testBits(h.abs(HDMAEN_SHADOW), true);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(PORTRAIT_WINDOW.layers);
  h.write(h.abs(TMW_SHADOW), ctx.a);
  h.index('x', PORTRAIT_WINDOW.edgeFirst);
  do {
    yield* call(0x80e470, 0x81b0a1, true);
    h.call(0x80e474, 0x80e41f, () => setPortraitWindowEdges(h));
    for (let n = 0; n < PORTRAIT_WINDOW.edgeStep; n++) h.index('x', ctx.x + 1);
    h.cpx(PORTRAIT_WINDOW.edgeEnd);
  } while (!(ctx.status & FLAG_CARRY));
  return h.rts();
}
// 80:E48D: second portrait channel A1 at VRAM 0800 (8FF5), HDMA entries 7E3D10/3D12/3F08, 1562 += 1 (81:A954).
function* e48dSequence(h, events, routines = WEAPON_MENU_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines);
  h.load(SECOND_PORTRAIT_PALETTE);
  h.write(h.abs(PORTRAIT_PALETTE_START), ctx.a);
  h.index('x', SECOND_PORTRAIT_VRAM);
  yield* call(0x80e496, 0x808ff5);
  for (const [address, value] of SECOND_PORTRAIT_HDMA_WORDS) {
    h.load(value);
    h.write(address, ctx.a);
  }
  h.call(
    0x80e4ae,
    0x81a954,
    () => {
      h.modify(h.abs(NMI_JOB_LISTS), 'inc');
      return h.rtl();
    },
    true,
  );
  return h.rts();
}
// 80:E4B3: portrait 94F7+2*1F54 (long pointer 8D:0000+X), OBJSEL 2101 = 40, 17D4 = 0, unpacked by 9F6D
// to 7F:5250, then 8F20, 9022, E48D and E433.
export function* e4b3Sequence(h, events, routines = WEAPON_MENU_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines);
  h.load(h.read(h.abs(MEMBER_PORTRAIT)));
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(h.abs(DIALOG_TABLE & WORD_MASK) + ctx.x));
  h.index('x', ctx.a);
  h.load(PORTRAIT_OBJSEL);
  h.portWrite(OBJSEL, ctx.a, 2, 0x80e4bf);
  h.write(h.abs(PALETTE_UPLOAD_LIST_BYTES), 0);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(DIALOG_BANK_BASE + 2 + ctx.x));
  h.dpWrite(DP_PORTRAIT_BANK, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.load(h.read(DIALOG_BANK_BASE + ctx.x));
  h.dpWrite(DP_PORTRAIT_POINTER, ctx.a);
  h.index('y', PORTRAIT_RECORD_BANK_BYTE);
  h.load(h.read(h.indirect(DP_PORTRAIT_POINTER, ctx.y)));
  h.load(ctx.a & BYTE_MASK);
  h.index('y', ctx.a);
  h.load(h.read(h.indirect(DP_PORTRAIT_POINTER)));
  h.index('x', PORTRAIT_BUFFER);
  yield* call(0x80e4e3, 0x809f6d);
  yield* call(0x80e4e6, 0x808f20);
  yield* call(0x80e4e9, 0x809022);
  yield* dialogCallBody(h, 0x80e4ec, 0x80e48d, () => e48dSequence(h, events, routines));
  yield* dialogCallBody(h, 0x80e4ef, 0x80e433, () => e433Sequence(h, events, routines));
  return h.rts();
}
// 80:E9A8: text for the item number in A (negative: 712E, else 8C:EFB0 + 6*8D:B022+A) over FE69.
function* e9a8Sequence(h, events, routines = WEAPON_MENU_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines);
  if (ctx.status & FLAG_NEGATIVE) h.load(TEXT_NONE);
  else {
    h.index('x', ctx.a);
    h.load(h.read(0x8db022 + ctx.x));
    h.asl();
    h.dpWrite(DP_SCRATCH, ctx.a);
    h.asl();
    h.adc(h.dp(DP_SCRATCH));
    h.index('x', ctx.a);
    h.load(h.read(0x8cefb0 + ctx.x));
  }
  h.dpWrite(2, ctx.a);
  yield* call(0x80e9c1, 0x80fe69);
  return h.rts();
}
// 80:E9C5: equipment window 1F4C: for the leader the value 7E3C15 (row 14), then from the entry
// 7E3C2E+4*1F60 the weapon name 3C31 (row 15) and the armour rating 3C30 (+2 for the leader with dermal
// armour 7E3C18) with the armour name 3C2E (row 16); see src/data/runners.mjs.
export function* e9c5Sequence(h, events, routines = WEAPON_MENU_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines),
    cursor = function* (pc, row) {
      store(h, [
        [2, STATUS_LAYOUT.valueColumn],
        [DP_CURSOR_ROW, row],
      ]);
      yield* call(pc, 0x80faac);
    };
  const leader = () => {
    h.load(h.read(h.abs(MEMBER_OBJECT)));
    h.cmp(h.read(h.abs(PLAYER_OBJECT)));
    return (ctx.status & FLAG_ZERO) !== 0;
  };
  h.load(h.read(h.abs(STATUS_WINDOW)));
  h.dpWrite(0, ctx.a);
  if (leader()) {
    yield* cursor(0x80e9dc, STATUS_LAYOUT.spellRow);
    h.load(h.read(WRAM + SELECTED_SPELL_NAME));
    h.dpWrite(2, ctx.a);
    yield* call(0x80e9e5, 0x80fe69);
  }
  yield* cursor(0x80e9f2, STATUS_LAYOUT.weaponRow);
  h.load(h.read(h.abs(MEMBER_INDEX)));
  h.asl();
  h.asl();
  h.index('x', ctx.a);
  h.load(h.read(WRAM + RUNNER_ARMOUR + ctx.x));
  h.pha();
  let bonus = false;
  if (leader()) {
    h.load(h.read(WRAM + JAKE_DERMAL_ARMOUR));
    h.load(ctx.a & BYTE_MASK);
    bonus = (ctx.status & FLAG_ZERO) === 0;
  }
  if (bonus) {
    clc(h);
    h.load(h.read(WRAM + RUNNER_ARMOUR_RATING + ctx.x));
    h.adc(DERMAL_ARMOUR_BONUS);
  } else h.load(h.read(WRAM + RUNNER_ARMOUR_RATING + ctx.x));
  h.load(ctx.a & BYTE_MASK);
  h.pha();
  h.load(h.read(WRAM + RUNNER_WEAPON + ctx.x));
  h.pha();
  store(h, [[2, TEXT_BLANK_FIELD]]);
  yield* call(0x80ea2d, 0x80fe69);
  yield* cursor(0x80ea3a, STATUS_LAYOUT.weaponRow);
  h.pla();
  yield* dialogCallBody(h, 0x80ea3e, 0x80e9a8, () => e9a8Sequence(h, events, routines));
  yield* cursor(0x80ea4b, STATUS_LAYOUT.armourRow);
  store(h, [[2, TEXT_BLANK_FIELD]]);
  yield* call(0x80ea53, 0x80fe69);
  yield* cursor(0x80ea60, STATUS_LAYOUT.armourRow);
  h.pla();
  h.dpWrite(2, ctx.a);
  yield* call(0x80ea66, 0x80fd80);
  h.pla();
  yield* dialogCallBody(h, 0x80ea6a, 0x80e9a8, () => e9a8Sequence(h, events, routines));
  return h.rts();
}
// 80:E693: the weapon menu (see above). The entry E68E (submenu of EA6E) clears 1F68 instead (STZ, BRA E699): then
// a choice of another object runs no script and E9C5 shows the weapon window at the end.
export function* e693Sequence(h, events, routines = WEAPON_MENU_ROUTINES, entry = 0x80e693) {
  const { ctx } = h,
    call = access(h, events, routines),
    slot = () => {
      h.load(h.read(h.indirect(DP_MEMBER_RECORD, ctx.y)));
      h.load(ctx.a & BYTE_MASK);
    };
  if (entry === 0x80e68e) h.write(h.abs(SPELL_CHOICE_RUNS_SCRIPT), 0);
  else {
    h.load(WORD_MASK);
    h.write(h.abs(SPELL_CHOICE_RUNS_SCRIPT), ctx.a);
  }
  h.index('x', 0);
  h.index('y', SPELL_SLOT_FIRST);
  do {
    slot();
    if (!(ctx.status & FLAG_ZERO)) h.index('x', ctx.x + 1);
    h.index('y', ctx.y + 1);
    h.cpy(SPELL_SLOT_END);
  } while (!(ctx.status & FLAG_ZERO));
  h.cpx(0);
  if (!(ctx.status & FLAG_ZERO)) {
    for (let n = 0; n < SPELL_WINDOW.extraRows; n++) h.index('x', ctx.x + 1);
    h.dpWrite(DP_WINDOW_ROWS, ctx.x);
    let spellWindow = SPELL_WINDOW;
    if (h.a.mem?.language) {
      const ids = [TEXT_EXIT];
      for (let slot = SPELL_SLOT_FIRST; slot < SPELL_SLOT_END; slot++) {
        const pointer = h.dp(DP_MEMBER_RECORD) | (h.dp(DP_MEMBER_RECORD_BANK, 1) << WORD_BITS),
          level = h.read(pointer + slot, 1);
        if (level)
          ids.push(h.read(0x80e7c8 + ((level - 1) * SPELL_COUNT + slot - SPELL_SLOT_FIRST) * 2));
      }
      spellWindow = translatedListWindow(h.a.mem, SPELL_WINDOW, ids);
    }
    store(h, [
      [DP_WINDOW_LEFT, spellWindow.left],
      [DP_WINDOW_TOP, spellWindow.top],
      [DP_WINDOW_COLUMNS, spellWindow.columns],
      [DP_WINDOW_ATTRIBUTES, 0],
    ]);
    yield* call(0x80e6ce, 0x80f963);
    h.load(h.dp(0));
    h.write(h.abs(STATUS_SUBMENU_WINDOW), ctx.a);
    h.dpWrite(DP_SPELL_LIST_OFFSET, 0);
    h.load(TEXT_EXIT);
    h.write(h.abs(MEMBER_MENU_NAMES), ctx.a);
    h.index('y', SPELL_SLOT_FIRST);
    do {
      slot();
      if (!(ctx.status & FLAG_ZERO)) {
        h.pha();
        h.load(ctx.a - 1);
        h.asl();
        h.asl();
        h.dpWrite(2, ctx.a);
        h.asl();
        h.adc(h.dp(2));
        h.dpWrite(2, ctx.a);
        h.load(ctx.y);
        h.asl();
        h.index('x', ctx.a);
        h.load(ctx.y);
        clc(h);
        h.adc(h.dp(DP_MEMBER_RECORD));
        h.pha();
        for (const column of [SPELL_SCRIPTS_A, SPELL_SCRIPTS_B, SPELL_NAMES]) {
          h.load(h.read(h.abs(column - SPELL_SLOT_INDEX_BIAS) + ctx.x));
          h.pha();
        }
        h.load(ctx.x);
        h.adc(h.dp(2));
        h.index('x', ctx.a);
        h.load(h.read(h.abs(SPELL_LEVEL_NAMES - SPELL_SLOT_INDEX_BIAS) + ctx.x));
        h.index('x', h.dp(DP_SPELL_LIST_OFFSET));
        h.index('x', ctx.x + 1);
        h.index('x', ctx.x + 1);
        h.dpWrite(DP_SPELL_LIST_OFFSET, ctx.x);
        h.write(h.abs(MEMBER_MENU_NAMES) + ctx.x, ctx.a);
        for (const column of [
          SPELL_MENU_SPELL_NAMES,
          SPELL_MENU_LEADER_SCRIPTS,
          SPELL_MENU_SCRIPTS,
          SPELL_MENU_LEVEL_POINTERS,
          SPELL_MENU_LEVELS,
        ]) {
          h.pla();
          h.write(h.abs(column) + ctx.x, ctx.a);
        }
      }
      h.index('y', ctx.y + 1);
      h.cpy(SPELL_SLOT_END);
    } while (!(ctx.status & FLAG_ZERO));
    h.index('x', h.dp(DP_SPELL_LIST_OFFSET));
    h.write(h.abs(MEMBER_MENU_NAMES + 2) + ctx.x, 0);
    h.load(1);
    h.dpWrite(DP_MENU_COLUMN, ctx.a);
    h.dpWrite(DP_MENU_ROW, 0);
    store(h, [
      [DP_MENU_VISIBLE_ROWS, SPELL_WINDOW.visibleRows],
      [DP_LIST_TOKENS, MEMBER_MENU_NAMES],
      [DP_LIST_TOKEN_BANK, WRAM_BANK],
    ]);
    yield* call(0x80e74c, 0x80a6c7);
    h.load(h.dp(0));
    if (!(ctx.status & FLAG_ZERO)) {
      if (ctx.status & FLAG_NEGATIVE) h.write(h.abs(DIALOG_END), ctx.a);
      else {
        h.asl();
        h.index('y', ctx.a);
        h.index('x', h.read(h.abs(SPELL_MENU_SCRIPTS) + ctx.y));
        h.load(h.read(h.abs(SPELL_MENU_LEVELS) + ctx.y));
        h.dpWrite(0, ctx.a);
        h.load(h.read(h.abs(MEMBER_OBJECT)));
        h.cmp(h.read(h.abs(PLAYER_OBJECT)));
        if (ctx.status & FLAG_ZERO) {
          for (const [column, target] of [
            [SPELL_MENU_LEADER_SCRIPTS, SELECTED_SPELL_SCRIPT],
            [SPELL_MENU_LEVEL_POINTERS, SELECTED_SPELL_LEVEL_POINTER],
            [SPELL_MENU_SPELL_NAMES, SELECTED_SPELL_NAME],
          ]) {
            h.load(h.read(h.abs(column) + ctx.y));
            h.write(WRAM + target, ctx.a);
          }
        } else {
          h.load(h.read(h.abs(SPELL_CHOICE_RUNS_SCRIPT)));
          if (!(ctx.status & FLAG_ZERO)) {
            yield* call(0x80e788, 0x80c34a);
            h.write(h.abs(MEMBER_PORTRAIT_REDRAW), 0);
            yield* call(0x80e78e, 0x80c1ca);
            h.load(h.read(h.abs(DIALOG_END)));
            if (ctx.status & FLAG_ZERO) {
              h.load(h.read(h.abs(MEMBER_PORTRAIT_REDRAW)));
              if (!(ctx.status & FLAG_ZERO)) {
                yield* call(0x80e79b, 0x81aeb0, true);
                if (routines.has(0x80e4b3)) yield* call(0x80e79f, 0x80e4b3);
                else
                  yield* dialogCallBody(h, 0x80e79f, 0x80e4b3, () =>
                    e4b3Sequence(h, events, routines),
                  );
              }
              h.index('x', NOTICE_WINDOW_LAST);
              let pending = false;
              for (;;) {
                h.load(h.read(WRAM + NOTICE_WINDOWS + ctx.x));
                if (!(ctx.status & FLAG_NEGATIVE)) {
                  pending = true;
                  break;
                }
                h.index('x', ctx.x - 1);
                h.index('x', ctx.x - 1);
                if (ctx.status & FLAG_NEGATIVE) break;
              }
              if (pending) {
                yield* call(0x80e7b1, 0x80f953);
                yield* call(0x80e7b4, 0x80ff79);
              }
            }
          }
        }
      }
    }
    h.load(h.read(h.abs(STATUS_SUBMENU_WINDOW)));
    h.dpWrite(0, ctx.a);
    yield* call(0x80e7bc, 0x80fa3e);
  }
  h.load(h.read(h.abs(SPELL_CHOICE_RUNS_SCRIPT)));
  if (ctx.status & FLAG_ZERO) {
    if (routines.has(0x80e9c5)) yield* call(0x80e7c4, 0x80e9c5);
    else yield* dialogCallBody(h, 0x80e7c4, 0x80e9c5, () => e9c5Sequence(h, events, routines));
  }
  return h.rts();
}

export function openWeaponMenu(a, events, outerReturn = true, routines = WEAPON_MENU_ROUTINES) {
  return drainNativeSequence(openWeaponMenuSequence(a, events, outerReturn, routines));
}
function* openWeaponMenuSequence(a, events, outerReturn, routines = WEAPON_MENU_ROUTINES) {
  if (
    a.ctx.d !== 0 ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_f254_entry_required');
  const h = dialogAccess(a),
    { ctx } = h;
  h.load(WORD_MASK);
  h.write(h.abs(MEMBER_MENU_ACTIVE), ctx.a);
  h.index('y', h.dp(0));
  h.index('x', RUNNER_LAST_INDEX);
  h.load(h.read(h.abs(OBJECT_NUMBER) + ctx.y));
  for (;;) {
    h.cmp(h.read(h.abs(RUNNER_OBJECT_NUMBERS) + ctx.x));
    if (ctx.status & FLAG_ZERO) break;
    h.index('x', ctx.x - 2);
    if (ctx.status & FLAG_NEGATIVE) break;
  }
  h.write(h.abs(MEMBER_NUMBER), ctx.a);
  h.write(h.abs(MEMBER_OBJECT), ctx.y);
  h.write(h.abs(MEMBER_INDEX), ctx.x);
  h.load(h.read(h.abs(RUNNER_RECORD_POINTERS) + ctx.x));
  clc(h);
  h.adc(SKILLS_START);
  h.dpWrite(DP_MEMBER_RECORD, ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(RUNNER_RECORD_BANKS) + ctx.x));
  h.dpWrite(DP_MEMBER_RECORD_BANK, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.write(h.abs(DIALOG_END), 0);
  if (routines.has(0x80e693)) yield* access(h, events, routines)(0x80f289, 0x80e693);
  else yield* dialogCallBody(h, 0x80f289, 0x80e693, () => e693Sequence(h, events, routines));
  h.write(h.abs(MEMBER_MENU_ACTIVE), 0);
  const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'F254-RTS', outerReturn);
  ctx.s = (ctx.s + 2) & WORD_MASK;
  ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return {
    rawReturnWord,
    returnTarget: CODE_BANK_BASE | ctx.pc,
    returnTargetExecuted: false,
    dynamicDispatchExecuted: false,
    frontier: 'observed-outer-RTS-target',
    scope: 'manual-source-specific-native-f254',
  };
}
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits and inputs replay the register-level
// native.
function observeOpenWeaponMenu(a, options, outerReturn, lifted = null) {
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
  return { sequence: openWeaponMenuSequence(a, events, outerReturn), finish };
}
function* liftedResult(sequence) {
  return { rawReturnWord: yield* sequence };
}
export function openWeaponMenuObserved(a, options, outerReturn = true, lifted = null) {
  const { sequence, finish } = observeOpenWeaponMenu(a, options, outerReturn, lifted);
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createOpenWeaponMenuObserved = (a, options, lifted = null) =>
  observedContinuation(a, observeOpenWeaponMenu(a, options, false, lifted));
