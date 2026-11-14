import { withInterruptEvents } from './observed-native-events.mjs';
import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import {
  observedContinuation,
  drainNativeSequence,
  dialogCallSequence,
  dialogCallBody,
} from './native-call-continuation.mjs';
import { validateDialogTaskOptions } from './native-dialog.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { STATUS_SCREEN_ROUTINES } from './native-status-screen.mjs';
import { chooseFromNumberedMenuWithSelectionAdapter } from './native-menu-compose.mjs';
import { playSoundEffectRoutine } from '../apu/sound-effect.mjs';
import { raiseMemberStateCount } from './native-state-count-raise.mjs';
import { raiseMemberMagicPoints } from './native-magic-points-raise.mjs';

import {
  KARMA,
  PLAYER_OBJECT,
  TIMER,
  WRAM,
  JAKE_BODY,
  JAKE_COUNT_MAX,
  DP_WINDOW_LEFT,
  DP_WINDOW_TOP,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_LIST_TOKENS,
  DP_LIST_TOKEN_BANK,
  DP_LIST_VALUES,
  DP_CURSOR_ROW,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  MAIN_MENU_WINDOW,
  KARMA_BALANCE_WINDOW,
  KARMA_CATEGORY_WINDOW,
  KARMA_HEADER_WINDOW,
  KARMA_LIST_WINDOW,
  KARMA_MENU_NAMES,
  KARMA_ROW_NAMES,
  KARMA_MENU_VALUES,
  KARMA_ROW_VALUES,
  KARMA_MENU_INDICES,
  KARMA_ROW_INDICES,
  DP_KARMA_VALUE_POINTER,
  DP_KARMA_VALUE_BANK,
  DP_KARMA_UPGRADE_COST,
  DP_KARMA_ROW_BYTES,
  DP_KARMA_DISPLAY,
  DP_KARMA_SELECTION,
  DP_KARMA_PREVIOUS_ROW_BYTES,
  DP_WEAPON_RECORD,
  DP_WEAPON_RECORD_BANK,
  SAVE_STATE_START,
  DP_SAVE_SLOT,
  DP_CHECKSUM_FIRST_SUM,
  DP_CHECKSUM_SECOND_SUM,
  DP_CHECKSUM_WORD,
  DP_CHECKSUM_HIGH,
} from './wram.mjs';
import {
  SLOT_OFFSETS_FOUR,
  saveSlotCount,
  FOUR_SAVE_SLOTS,
  ORIGINAL_SAVE_SLOTS,
  SLOT_CHECKED_BYTES,
  SECOND_SUM_START,
  CHECKSUM_KEY,
} from '../game/save-slots.mjs';
import {
  PORT_BASE,
  TEXT_EXIT,
  TEXT_SAVE_GAME_1,
  TEXT_SAVE_GAME_2,
  PORT_TEXTS,
} from '../data/port-extension.mjs';
import { fitListWindow, listTextIds } from '../data/menu-layout.mjs';
import { RUNNER_RECORD_POINTERS, RUNNER_RECORD_BANKS } from '../data/runners.mjs';
import { BYTE_MASK, WORD_MASK, WORD_BITS, BANK_WRAP } from '../constants/bits.mjs';
import {
  FLAG_CARRY,
  FLAG_ZERO,
  FLAG_MEMORY_8BIT,
  FLAG_NEGATIVE,
  FLAG_INDEX_8BIT,
} from '../constants/cpu-flags.mjs';
import { CODE_BANK, CODE_BANK_BASE, WRAM_BANK, SRAM_FIRST_BANK } from '../constants/memory-map.mjs';

// CE6D/CDD6 window geometry and row counts from their pinned F963/A6C7 calls.
const MAIN_WINDOW = Object.freeze({
  left: 10,
  top: 10,
  columns: 12,
  rows: 5,
  fourSlotRows: 7,
  visibleRows: 3,
  fourSlotVisibleRows: 5,
});
const SAVE_BLOCKED_WINDOW = Object.freeze({ columns: 14, rows: 6 });
export const KARMA_WINDOWS = Object.freeze({
  left: 3,
  columns: 11,
  balanceTop: 5,
  balanceRows: 3,
  categoryTop: 8,
  categoryRows: 6,
  categoryVisibleRows: 4,
  detailLeft: 14,
  detailColumns: 16,
  headerTop: 5,
  headerRows: 3,
  listTop: 8,
  listRows: 9,
  listVisibleRows: 7,
});
const KARMA_NOTICE_WINDOW = Object.freeze({ left: 14, top: 2, columns: 16, rows: 3 });
const WINDOW_ROWS_INDEX = 3;
const MAIN_MENU_ITEMS = 0xcec3,
  SAVE_MENU_ITEMS = 0xce65,
  KARMA_MENU_ITEMS = 0xef78;
const TEXT_SAVE_BLOCKED = 0x7058,
  TEXT_KARMA = 0x7117,
  TEXT_KARMA_INSUFFICIENT = 0x711b;
const KARMA_BALANCE_NUMBER_COLUMN = 6;
const KARMA_VALUE_COLUMNS = 3;
// EFB2 names Jake's Body byte; F0F3 increases its count maximum by ten
// and supplies the same state count increment to CECB after buying Body.
const BODY_UPGRADE_COUNT_INCREMENT = 10;
const SAVE_SOUND_ARGUMENT = 0x36;
const SAVE_SRAM_BASE = SRAM_FIRST_BANK << WORD_BITS,
  SAVE_COPY_MVN_COUNT = SLOT_CHECKED_BYTES + 1,
  EXTENDED_SLOT_TABLE_INDEX = ORIGINAL_SAVE_SLOTS * 2;

// 80:CE6D (no argument, no result): open the main menu. Window 0A/0A/0C/05 (1CED) and menu CEC3 (3 rows); after
// releasing the window a choice 1 saves (CDD6), 2 opens the karma menu (EE57), 0 or negative ends. Both
// return to the menu.
export const MAIN_MENU_ROUTINES = new Map([
  ...STATUS_SCREEN_ROUTINES,
  [0x80a6b8, chooseFromNumberedMenuWithSelectionAdapter],
  [0x80c46e, playSoundEffectRoutine],
  [0x80cecb, (h, e) => raiseMemberStateCount(h.a, e, false)],
  [0x80cf2e, (h) => raiseMemberMagicPoints(h.a, false)],
]);
// A table callee with its real frame; registered continuations are chosen by target and function identity.
const access =
  (h, events, routines) =>
  (pc, target, long = false) => {
    if (!routines.get(target)) taskStop('task_ce6d_routine_open', { pc, target });
    return dialogCallSequence(h, events, routines, pc, target, long);
  };
const store = (h, pairs) => {
  for (const [offset, value] of pairs) {
    h.load(value);
    h.dpWrite(offset, h.ctx.a);
  }
};
function* window(h, call, pc, values, keep, ids = [], options) {
  store(h, [
    [DP_WINDOW_LEFT, values[0]],
    [DP_WINDOW_TOP, values[1]],
    [DP_WINDOW_COLUMNS, values[2]],
    [DP_WINDOW_ROWS, values[WINDOW_ROWS_INDEX]],
    [DP_WINDOW_ATTRIBUTES, 0],
  ]);
  fitListWindow(h.a.mem, h, ids, options);
  yield* call(pc, 0x80f963);
  if (keep !== undefined) {
    h.load(h.dp(0));
    h.write(h.abs(keep), h.ctx.a);
  }
}
function* release(h, call, pc, offset) {
  h.load(h.read(h.abs(offset)));
  h.dpWrite(0, h.ctx.a);
  yield* call(pc, 0x80fa3e);
}
// A menu routine from the table when present (the lifted one), else its own body.
function* routineOrBody(h, call, routines, pc, target, body) {
  if (routines.has(target)) yield* call(pc, target);
  else yield* dialogCallBody(h, pc, target, body);
}

// 81:B174 (BYTE-A): end-around carry: carry adds 1, FF becomes 0.
function runEndAroundCarry(h) {
  const { ctx } = h;
  if (ctx.status & FLAG_CARRY) h.load(ctx.a + 1);
  h.cmp(BYTE_MASK);
  if (ctx.status & FLAG_ZERO) h.load(ctx.a + 1);
  return h.rts();
}
// 81:B11A: X = slot offset 81:B124+2*DP0E. Slots 3/4 of the four-slot option
// use their own offsets behind the original 8 KiB (src/game/save-slots.mjs).
export function getSaveSlotOffset(h) {
  const { ctx } = h;
  h.load(h.dp(DP_SAVE_SLOT));
  h.asl();
  h.index('x', ctx.a);
  if (ctx.x >= EXTENDED_SLOT_TABLE_INDEX && saveSlotCount(h.a) === FOUR_SAVE_SLOTS)
    h.load(SLOT_OFFSETS_FOUR[ctx.x >> 1]);
  else h.load(h.read(0x81b124 + ctx.x));
  h.index('x', ctx.a);
  return h.rts();
}
// 81:B12C: checksum of the slot (70:X+2, 0F26 bytes) with two running sums from 0 and AD, A = word 14 EOR ABA5.
function runSaveChecksum(h) {
  const { ctx } = h,
    add = (pc, offset) => {
      ctx.status &= ~FLAG_CARRY;
      h.adc(h.dp(offset));
      h.call(pc, 0x81b174, () => runEndAroundCarry(h));
    };
  h.call(0x81b12c, 0x81b11a, () => getSaveSlotOffset(h));
  h.phx();
  h.index('x', ctx.x + 1);
  h.index('x', ctx.x + 1);
  h.index('y', SLOT_CHECKED_BYTES);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(SECOND_SUM_START);
  h.dpWrite(DP_CHECKSUM_SECOND_SUM, ctx.a);
  h.dpWrite(DP_CHECKSUM_FIRST_SUM, 0);
  do {
    h.load(h.read(SAVE_SRAM_BASE + ctx.x));
    h.index('x', ctx.x + 1);
    add(0x81b145, DP_CHECKSUM_FIRST_SUM);
    h.dpWrite(DP_CHECKSUM_FIRST_SUM, ctx.a);
    add(0x81b14d, DP_CHECKSUM_SECOND_SUM);
    h.dpWrite(DP_CHECKSUM_SECOND_SUM, ctx.a);
    h.index('y', ctx.y - 1);
  } while (!(ctx.status & FLAG_ZERO));
  h.load(h.dp(DP_CHECKSUM_FIRST_SUM));
  add(0x81b15a, DP_CHECKSUM_SECOND_SUM);
  h.load(ctx.a ^ BYTE_MASK);
  h.dpWrite(DP_CHECKSUM_SECOND_SUM, ctx.a);
  add(0x81b164, DP_CHECKSUM_FIRST_SUM);
  h.load(ctx.a ^ BYTE_MASK);
  h.dpWrite(DP_CHECKSUM_HIGH, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  h.plx();
  h.load(h.dp(DP_CHECKSUM_WORD));
  h.load(ctx.a ^ CHECKSUM_KEY);
  return h.rts();
}
// 81:B17D: save slot A: 7E:2DE0..3D07 (0F28 bytes) by MVN to SRAM 70:B124[slot], checksum to 70:slot.
export function saveGameSlot(h) {
  const { ctx } = h;
  h.php();
  h.phb();
  h.dpWrite(DP_SAVE_SLOT, ctx.a);
  h.call(0x81b181, 0x81b11a, () => getSaveSlotOffset(h));
  h.index('y', ctx.x);
  h.index('x', SAVE_STATE_START);
  h.load(SAVE_COPY_MVN_COUNT);
  h.move(WRAM_BANK, SRAM_FIRST_BANK, 1);
  h.call(0x81b18e, 0x81b12c, () => runSaveChecksum(h));
  h.write(SAVE_SRAM_BASE + ctx.x, ctx.a);
  h.plb();
  h.plp();
  return h.rtl();
}
// 81:B1AB: checksum comparison for a selected slot; no validity policy is
// inferred. The caller consumes the original CMP flags and SRAM offset in X.
export function compareSaveChecksum(h) {
  h.dpWrite(DP_SAVE_SLOT, h.ctx.a);
  h.call(0x81b1ad, 0x81b12c, () => runSaveChecksum(h));
  h.cmp(h.read(SAVE_SRAM_BASE + h.ctx.x));
  return h.rtl();
}
// 80:CDD6: save. With 1D89 negative: window 0A/0A/0C/05 (1CED), menu CE65 (3 rows); slot n > 0 saves n-1 over
// 81:B17D and plays sound 36 (C46E with FFFF/FF/FF), then FA3E. Otherwise the notice 7058 in window
// 0A/0A/0E/06, F953 and FA3E.
export function* cdd6Sequence(h, events, routines = MAIN_MENU_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines);
  h.load(h.read(h.abs(TIMER)));
  if (!(ctx.status & FLAG_NEGATIVE)) {
    yield* window(
      h,
      call,
      0x80ce53,
      [MAIN_WINDOW.left, MAIN_WINDOW.top, SAVE_BLOCKED_WINDOW.columns, SAVE_BLOCKED_WINDOW.rows],
      undefined,
      [TEXT_SAVE_BLOCKED],
      { column: 0 },
    );
    store(h, [[2, TEXT_SAVE_BLOCKED]]);
    yield* call(0x80ce5b, 0x80fe69);
    yield* call(0x80ce5e, 0x80f953);
    yield* call(0x80ce61, 0x80fa3e);
    return h.rts();
  }
  // Four-slot option: two more rows and the item list in the port bank
  // (src/data/port-extension.mjs) with "Save game 3/4"; the result n > 0
  // still saves slot n-1.
  const four = saveSlotCount(h.a) === FOUR_SAVE_SLOTS;
  yield* window(
    h,
    call,
    0x80cdf1,
    [
      MAIN_WINDOW.left,
      MAIN_WINDOW.top,
      MAIN_WINDOW.columns,
      four ? MAIN_WINDOW.fourSlotRows : MAIN_WINDOW.rows,
    ],
    MAIN_MENU_WINDOW,
    [
      TEXT_EXIT,
      TEXT_SAVE_GAME_1,
      TEXT_SAVE_GAME_2,
      ...(four ? PORT_TEXTS.map(({ id }) => id) : []),
    ],
  );
  store(h, [[2, 1]]);
  h.dpWrite(DP_MENU_ROW, 0);
  store(h, [
    [DP_MENU_VISIBLE_ROWS, four ? MAIN_WINDOW.fourSlotVisibleRows : MAIN_WINDOW.visibleRows],
    [DP_LIST_TOKENS, four ? PORT_BASE & WORD_MASK : SAVE_MENU_ITEMS],
    [DP_LIST_TOKEN_BANK, four ? PORT_BASE >>> WORD_BITS : CODE_BANK],
  ]);
  yield* call(0x80ce0f, 0x80a6c7);
  h.load(h.dp(0));
  if (!(ctx.status & (FLAG_ZERO | FLAG_NEGATIVE))) {
    h.load(ctx.a - 1);
    h.call(0x80ce19, 0x81b17d, () => saveGameSlot(h), true);
    store(h, [
      [0, WORD_MASK],
      [DP_SOUND_LEVEL, BYTE_MASK],
      [DP_SOUND_VOICE, BYTE_MASK],
      [2, SAVE_SOUND_ARGUMENT],
    ]);
    yield* call(0x80ce31, 0x80c46e);
  }
  yield* release(h, call, 0x80ce39, MAIN_MENU_WINDOW);
  return h.rts();
}
// 80:EF82: karma line: FA67 on 1F4C, text 7117 at 0/0, the karma 7E3C11/8 (also to DP17) at 6/0.
export function* ef82Sequence(h, events, routines = MAIN_MENU_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines);
  h.load(h.read(h.abs(KARMA_BALANCE_WINDOW)));
  h.dpWrite(0, ctx.a);
  yield* call(0x80ef87, 0x80fa67);
  h.dpWrite(2, 0);
  h.dpWrite(DP_CURSOR_ROW, 0);
  yield* call(0x80ef8e, 0x80faac);
  store(h, [[2, TEXT_KARMA]]);
  yield* call(0x80ef96, 0x80fe69);
  store(h, [[2, KARMA_BALANCE_NUMBER_COLUMN]]);
  h.dpWrite(DP_CURSOR_ROW, 0);
  yield* call(0x80efa0, 0x80faac);
  h.load(h.read(WRAM + KARMA));
  h.lsr();
  h.lsr();
  h.lsr();
  h.dpWrite(DP_KARMA_DISPLAY, ctx.a);
  h.dpWrite(2, ctx.a);
  yield* call(0x80efae, 0x80fd80);
  return h.rts();
}
// 80:F006: buy one step of the value [0E]: cost 8 * value (BYTE); karma 7E3C11 below the cost shows the notice
// 711B (window 0E/02/10/03, F953, FA3E) and clears DP0E, else the karma drops and [0E] BYTE rises by 1.
export function* f006Sequence(h, events, routines = MAIN_MENU_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines);
  h.load(h.read(h.indirect(DP_KARMA_VALUE_POINTER)));
  h.load(ctx.a & BYTE_MASK);
  h.asl();
  h.asl();
  h.asl();
  h.dpWrite(DP_KARMA_UPGRADE_COST, ctx.a);
  ctx.status |= FLAG_CARRY;
  h.load(h.read(WRAM + KARMA));
  h.sbc(h.dp(DP_KARMA_UPGRADE_COST));
  if (ctx.status & FLAG_CARRY) {
    h.write(WRAM + KARMA, ctx.a);
    h.sep(FLAG_MEMORY_8BIT);
    h.load(h.read(h.indirect(DP_KARMA_VALUE_POINTER)));
    h.load(ctx.a + 1);
    h.write(h.indirect(DP_KARMA_VALUE_POINTER), ctx.a);
    h.rep(FLAG_MEMORY_8BIT);
    return h.rts();
  }
  yield* window(
    h,
    call,
    0x80f032,
    [
      KARMA_NOTICE_WINDOW.left,
      KARMA_NOTICE_WINDOW.top,
      KARMA_NOTICE_WINDOW.columns,
      KARMA_NOTICE_WINDOW.rows,
    ],
    undefined,
    [TEXT_KARMA_INSUFFICIENT],
    { column: 0 },
  );
  store(h, [[2, TEXT_KARMA_INSUFFICIENT]]);
  yield* call(0x80f03a, 0x80fe69);
  yield* call(0x80f03d, 0x80f953);
  yield* call(0x80f040, 0x80fa3e);
  h.dpWrite(DP_KARMA_VALUE_POINTER, 0);
  return h.rts();
}
// The three karma lists: header text, value pointers (bank 7E via DP10), names, limits, entry count and where
// the loop starts again (F054 rebuilds the header, F0F3 and F1B5 only the rows). Values below their limit are
// listed (1DAB names, 1EB1 values, 1E2F indices); a changed row count resets the cursor DP1A. The menu A6B8 in
// window 1F52 buys with F006 (F0F3: the value 7E3BFB also raises 7E3C00 by 0A and raises the state count of the
// leader over CECB with FF... 0A) and shows the karma again (EF82).
export const KARMA_LISTS = Object.freeze({
  0x80f054: {
    text: 0x70bb,
    pointers: 0xefca,
    names: 0xefd2,
    limits: 0xefda,
    end: 8,
    header: true,
    pcs: { text: 0x80f059, request: 0x80f0b3, menu: 0x80f0d3, buy: 0x80f0e9, karma: 0x80f0ec },
  },
  0x80f0f3: {
    text: 0x7490,
    pointers: 0xefb2,
    names: 0xefba,
    limits: 0xefc2,
    end: 8,
    header: false,
    body: true,
    pcs: {
      text: 0x80f0f8,
      request: 0x80f152,
      menu: 0x80f172,
      buy: 0x80f188,
      karma: 0x80f1ae,
      refill: 0x80f1ab,
    },
  },
  0x80f1b5: {
    text: 0x709d,
    pointers: 0xefe2,
    names: 0xefee,
    limits: 0xeffa,
    end: 0x0c,
    header: false,
    pcs: { text: 0x80f1ba, request: 0x80f214, menu: 0x80f234, buy: 0x80f24a, karma: 0x80f24d },
  },
});
export function* karmaListSequence(h, events, routines = MAIN_MENU_ROUTINES, entry) {
  const { ctx } = h,
    call = access(h, events, routines),
    list = KARMA_LISTS[entry];
  const header = () => {
    h.load(TEXT_EXIT);
    h.write(h.abs(KARMA_MENU_NAMES), ctx.a);
    h.write(h.abs(KARMA_MENU_VALUES), 0);
  };
  store(h, [[2, list.text]]);
  yield* call(list.pcs.text, 0x80fe69);
  store(h, [[DP_KARMA_VALUE_BANK, WRAM_BANK]]);
  if (list.header) {
    h.load(WORD_MASK);
    h.dpWrite(DP_KARMA_PREVIOUS_ROW_BYTES, ctx.a);
  } else {
    header();
    h.load(WORD_MASK);
    h.dpWrite(DP_KARMA_PREVIOUS_ROW_BYTES, ctx.a);
  }
  for (;;) {
    if (list.header) header();
    h.index('x', 0);
    h.dpWrite(DP_KARMA_ROW_BYTES, ctx.x);
    do {
      h.load(h.read(h.abs(list.pointers) + ctx.x));
      h.dpWrite(DP_KARMA_VALUE_POINTER, ctx.a);
      h.load(h.read(h.indirect(DP_KARMA_VALUE_POINTER)));
      h.load(ctx.a & BYTE_MASK);
      if (!(ctx.status & FLAG_ZERO)) {
        h.cmp(h.read(h.abs(list.limits) + ctx.x));
        if (!(ctx.status & FLAG_CARRY)) {
          h.pha();
          h.load(h.read(h.abs(list.names) + ctx.x));
          h.index('y', h.dp(DP_KARMA_ROW_BYTES));
          h.write(h.abs(KARMA_ROW_NAMES) + ctx.y, ctx.a);
          h.pla();
          h.write(h.abs(KARMA_ROW_VALUES) + ctx.y, ctx.a);
          h.load(ctx.x);
          h.write(h.abs(KARMA_ROW_INDICES) + ctx.y, ctx.a);
          h.index('y', ctx.y + 1);
          h.index('y', ctx.y + 1);
          h.dpWrite(DP_KARMA_ROW_BYTES, ctx.y);
        }
      }
      h.index('x', ctx.x + 1);
      h.index('x', ctx.x + 1);
      h.cpx(list.end);
    } while (!(ctx.status & FLAG_CARRY));
    h.index('x', h.dp(DP_KARMA_ROW_BYTES));
    h.write(h.abs(KARMA_ROW_NAMES) + ctx.x, 0);
    h.cpx(h.dp(DP_KARMA_PREVIOUS_ROW_BYTES));
    if (!(ctx.status & FLAG_ZERO)) {
      h.dpWrite(DP_KARMA_PREVIOUS_ROW_BYTES, ctx.x);
      h.dpWrite(DP_KARMA_SELECTION, 0);
    }
    h.load(h.read(h.abs(KARMA_LIST_WINDOW)));
    h.dpWrite(0, ctx.a);
    yield* call(list.pcs.request, 0x80fa67);
    store(h, [[2, 1]]);
    h.dpWrite(DP_MENU_ROW, 0);
    store(h, [
      [DP_MENU_VISIBLE_ROWS, KARMA_WINDOWS.listVisibleRows],
      [DP_LIST_TOKENS, KARMA_MENU_NAMES],
      [DP_LIST_TOKEN_BANK, WRAM_BANK],
      [DP_LIST_VALUES, KARMA_MENU_VALUES],
    ]);
    h.load(h.dp(DP_KARMA_SELECTION));
    yield* call(list.pcs.menu, 0x80a6b8);
    h.load(h.dp(0));
    if (ctx.status & (FLAG_ZERO | FLAG_NEGATIVE)) return h.rts();
    h.dpWrite(DP_KARMA_SELECTION, ctx.a);
    h.asl();
    h.index('x', ctx.a);
    h.load(h.read(h.abs(KARMA_MENU_INDICES) + ctx.x));
    h.index('x', ctx.a);
    h.load(h.read(h.abs(list.pointers) + ctx.x));
    h.dpWrite(DP_KARMA_VALUE_POINTER, ctx.a);
    yield* routineOrBody(h, call, routines, list.pcs.buy, 0x80f006, () =>
      f006Sequence(h, events, routines),
    );
    if (list.body) {
      h.load(h.dp(DP_KARMA_VALUE_POINTER));
      h.cmp(JAKE_BODY);
      if (ctx.status & FLAG_ZERO) {
        h.sep(FLAG_MEMORY_8BIT);
        ctx.status &= ~FLAG_CARRY;
        h.load(h.read(WRAM + JAKE_COUNT_MAX));
        h.adc(BODY_UPGRADE_COUNT_INCREMENT);
        h.write(WRAM + JAKE_COUNT_MAX, ctx.a);
        h.rep(FLAG_MEMORY_8BIT);
        h.load(h.read(h.abs(PLAYER_OBJECT)));
        h.dpWrite(0, ctx.a);
        store(h, [[2, BODY_UPGRADE_COUNT_INCREMENT]]);
        yield* call(list.pcs.refill, 0x80cecb);
      }
    }
    yield* routineOrBody(h, call, routines, list.pcs.karma, 0x80ef82, () =>
      ef82Sequence(h, events, routines),
    );
  }
}
// 80:EE57: karma menu. FF79, BCB2, [F9] = 971A/9734 (weapon 0), windows 03/05/0B/03 (1F4C) and 03/08/0B/06
// (1F4E), EF82; menu EF78 (4 rows) in 1F4E: 1 F0F3, 2 F054, other rows F1B5, each in the windows 0E/05/10/03
// (1F50) and 0E/08/10/09 (1F52) released afterwards. 0 or FFFF ends: releases, then CECB and CF2E for the
// leader with FF.
export function* ee57Sequence(h, events, routines = MAIN_MENU_ROUTINES) {
  const { ctx } = h,
    call = access(h, events, routines);
  yield* call(0x80ee57, 0x80ff79);
  yield* call(0x80ee5a, 0x80bcb2);
  h.load(h.read(h.abs(RUNNER_RECORD_POINTERS)));
  h.dpWrite(DP_WEAPON_RECORD, ctx.a);
  h.sep(FLAG_MEMORY_8BIT);
  h.load(h.read(h.abs(RUNNER_RECORD_BANKS)));
  h.dpWrite(DP_WEAPON_RECORD_BANK, ctx.a);
  h.rep(FLAG_MEMORY_8BIT);
  yield* window(
    h,
    call,
    0x80ee84,
    [
      KARMA_WINDOWS.left,
      KARMA_WINDOWS.balanceTop,
      KARMA_WINDOWS.columns,
      KARMA_WINDOWS.balanceRows,
    ],
    KARMA_BALANCE_WINDOW,
  );
  yield* window(
    h,
    call,
    0x80eea5,
    [
      KARMA_WINDOWS.left,
      KARMA_WINDOWS.categoryTop,
      KARMA_WINDOWS.columns,
      KARMA_WINDOWS.categoryRows,
    ],
    KARMA_CATEGORY_WINDOW,
    h.a.mem?.language
      ? listTextIds(h.a.mem, CODE_BANK_BASE | KARMA_MENU_ITEMS, KARMA_WINDOWS.categoryVisibleRows)
      : [],
  );
  yield* routineOrBody(h, call, routines, 0x80eead, 0x80ef82, () =>
    ef82Sequence(h, events, routines),
  );
  // German category and upgrade labels cannot both fit across thirty tiles.
  // Keep the choices above the detail header/list instead of covering them.
  const translated = Boolean(h.a.mem?.language),
    detailTop = translated
      ? KARMA_WINDOWS.categoryTop + KARMA_WINDOWS.categoryRows + 1
      : KARMA_WINDOWS.headerTop,
    detailIds = translated
      ? [
          TEXT_EXIT,
          ...Object.values(KARMA_LISTS).flatMap((list) => [
            list.text,
            ...listTextIds(h.a.mem, CODE_BANK_BASE | list.names, list.end / 2),
          ]),
        ]
      : [];
  for (;;) {
    h.load(h.read(h.abs(KARMA_CATEGORY_WINDOW)));
    h.dpWrite(0, ctx.a);
    yield* call(0x80eeb5, 0x80fa67);
    store(h, [[2, 1]]);
    h.dpWrite(DP_MENU_ROW, 0);
    store(h, [
      [DP_MENU_VISIBLE_ROWS, KARMA_WINDOWS.categoryVisibleRows],
      [DP_LIST_TOKENS, KARMA_MENU_ITEMS],
      [DP_LIST_TOKEN_BANK, CODE_BANK],
    ]);
    yield* call(0x80eece, 0x80a6c7);
    h.load(h.dp(0));
    if (ctx.status & FLAG_ZERO) break;
    h.cmp(WORD_MASK);
    if (ctx.status & FLAG_ZERO) break;
    h.pha();
    yield* window(
      h,
      call,
      0x80eef4,
      [KARMA_WINDOWS.detailLeft, detailTop, KARMA_WINDOWS.detailColumns, KARMA_WINDOWS.headerRows],
      KARMA_HEADER_WINDOW,
      detailIds,
      { valueColumns: KARMA_VALUE_COLUMNS },
    );
    yield* window(
      h,
      call,
      0x80ef15,
      [
        KARMA_WINDOWS.detailLeft,
        translated ? detailTop + KARMA_WINDOWS.headerRows : KARMA_WINDOWS.listTop,
        KARMA_WINDOWS.detailColumns,
        KARMA_WINDOWS.listRows,
      ],
      KARMA_LIST_WINDOW,
      detailIds,
      { valueColumns: KARMA_VALUE_COLUMNS },
    );
    h.load(h.read(h.abs(KARMA_HEADER_WINDOW)));
    h.dpWrite(0, ctx.a);
    h.pla();
    h.cmp(1);
    let pc = 0x80ef37,
      entry = 0x80f1b5;
    if (ctx.status & FLAG_ZERO) [pc, entry] = [0x80ef28, 0x80f0f3];
    else {
      h.cmp(2);
      if (ctx.status & FLAG_ZERO) [pc, entry] = [0x80ef32, 0x80f054];
    }
    yield* routineOrBody(h, call, routines, pc, entry, () =>
      karmaListSequence(h, events, routines, entry),
    );
    yield* release(h, call, 0x80ef3f, KARMA_LIST_WINDOW);
    yield* release(h, call, 0x80ef47, KARMA_HEADER_WINDOW);
  }
  yield* release(h, call, 0x80ef52, KARMA_CATEGORY_WINDOW);
  yield* release(h, call, 0x80ef5a, KARMA_BALANCE_WINDOW);
  for (const [pc, target] of [
    [0x80ef67, 0x80cecb],
    [0x80ef74, 0x80cf2e],
  ]) {
    h.load(h.read(h.abs(PLAYER_OBJECT)));
    h.dpWrite(0, ctx.a);
    store(h, [[2, BYTE_MASK]]);
    yield* call(pc, target);
  }
  return h.rts();
}
export function openMainMenu(a, events, outerReturn = true, routines = MAIN_MENU_ROUTINES) {
  return drainNativeSequence(openMainMenuSequence(a, events, outerReturn, routines));
}
function* openMainMenuSequence(a, events, outerReturn, routines = MAIN_MENU_ROUTINES) {
  if (
    a.ctx.d !== 0 ||
    a.ctx.programBank !== CODE_BANK ||
    a.ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('task_ce6d_entry_required');
  const h = dialogAccess(a),
    { ctx } = h;
  yield* mainMenuLoop(h, events, routines);
  const rawReturnWord = a.readWord((ctx.s + 1) & WORD_MASK, BANK_WRAP, 'CE6D-RTS', outerReturn);
  ctx.s = (ctx.s + 2) & WORD_MASK;
  ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return {
    rawReturnWord,
    returnTarget: CODE_BANK_BASE | ctx.pc,
    returnTargetExecuted: false,
    dynamicDispatchExecuted: false,
    frontier: 'observed-outer-RTS-target',
    scope: 'manual-source-specific-native-ce6d',
  };
}
// The main menu as a routine with its RTS (the function test's reference).
export function* mainMenuRoutineSequence(h, events, routines = MAIN_MENU_ROUTINES) {
  yield* mainMenuLoop(h, events, routines);
  return h.rts();
}
// CE6D up to its RTS; the save and karma menus from the table when present.
function* mainMenuLoop(h, events, routines) {
  const { ctx } = h,
    call = access(h, events, routines);
  for (;;) {
    yield* window(
      h,
      call,
      0x80ce83,
      [MAIN_WINDOW.left, MAIN_WINDOW.top, MAIN_WINDOW.columns, MAIN_WINDOW.rows],
      MAIN_MENU_WINDOW,
      h.a.mem?.language
        ? listTextIds(h.a.mem, CODE_BANK_BASE | MAIN_MENU_ITEMS, MAIN_WINDOW.visibleRows)
        : [],
    );
    store(h, [[2, 1]]);
    h.dpWrite(DP_MENU_ROW, 0);
    store(h, [
      [DP_MENU_VISIBLE_ROWS, MAIN_WINDOW.visibleRows],
      [DP_LIST_TOKENS, MAIN_MENU_ITEMS],
      [DP_LIST_TOKEN_BANK, CODE_BANK],
    ]);
    yield* call(0x80cea1, 0x80a6c7);
    h.push(h.dp(0), 2);
    yield* release(h, call, 0x80ceab, MAIN_MENU_WINDOW);
    h.pla();
    if (ctx.status & (FLAG_ZERO | FLAG_NEGATIVE)) break;
    h.cmp(1);
    if (ctx.status & FLAG_ZERO)
      yield* routineOrBody(h, call, routines, 0x80ceb8, 0x80cdd6, () =>
        cdd6Sequence(h, events, routines),
      );
    else
      yield* routineOrBody(h, call, routines, 0x80cebd, 0x80ee57, () =>
        ee57Sequence(h, events, routines),
      );
  }
}
// lifted (optional): the lifted native's sequence (h, events), which runs instead with
// lag-free frames (the live game); recorded waits and inputs replay the register-level
// native.
function observeOpenMainMenu(a, options, outerReturn, lifted = null) {
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
  return { sequence: openMainMenuSequence(a, events, outerReturn), finish };
}
function* liftedResult(sequence) {
  return { rawReturnWord: yield* sequence };
}
export function openMainMenuObserved(a, options, outerReturn = true, lifted = null) {
  const { sequence, finish } = observeOpenMainMenu(a, options, outerReturn, lifted);
  return finish(drainNativeSequence(sequence));
}
// The scheduler's native bridge owns this continuation between work budgets.
export const createOpenMainMenuObserved = (a, options, lifted = null) =>
  observedContinuation(a, observeOpenMainMenu(a, options, false, lifted));
