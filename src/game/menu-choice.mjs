// A choice from a menu list (lifted from 80:A6A5 to 80:A845; register-level version in
// src/task/native-menu-compose.mjs stays the reference).
//
// The caller passes the window in the direct page word 00, the list's column and row in
// 02 and 04, its visible rows in 06, the long pointer to its texts (words ended by 0) in
// 08 to 0A and, for numbers or hotkeys, a word list in 0C (data bank). Four entries
// differ in their start: 80:A6A5 with hotkeys, 80:A6AD with numbers, 80:A6B8 with numbers
// and the row in A preselected, 80:A6C7 plain. The list is drawn (80:A617) and the
// selection marked (80:A5F9, menu-list.mjs).
//
// Every frame (the word wait 81:B0A1, then the pad word 80:9E1A) the newly pressed
// buttons are taken; up or down held for 14 frames repeats every frame after (the
// counter set back to 13). Y cancels: the mark is removed (80:A5DB) and FFFF is the
// result. B, A, X or Start confirm: the mark is removed, the confirm sound 4C plays
// (80:C46E) and the selected row is the result. Down moves to the next row while one
// follows, up to the one before; without hotkeys R and L page forward and back by the
// visible rows. A move past the page shows the next or previous page (the window's text
// tiles cleared by 80:FA67, the list drawn again), otherwise the old mark is removed;
// then the new row is marked. A menu with hotkeys confirms the first row whose hotkey
// word (the list in 0C) has a newly pressed button. The result is left in the direct page
// word 00 after the pad word is taken once more.
//
// The wait, the pad word and the sound come from the caller's routine table, the text
// buffer 80:FB39 of the list's texts too; the list drawing, the marks and the tile
// request run lifted. The registers are passed and left as the original: each callee
// gets the A, X, Y and flags the original's code leaves before its call (the helpers
// use only Y), the routine leaves those of the last pad word with the result in 00. A
// move's pushes of the direct page words 00 and 06 (around the move sound's arguments,
// which the original sets up and restores without playing it) stay below the stack.
import { dialogCallBody, dialogCallSequence } from '../task/native-call-continuation.mjs';
import { drawListSequence, markRowSequence, MARK, UNMARK } from './menu-list.mjs';
import { requestTileClearSequence } from './window-open.mjs';
import {
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_LIST_VALUES,
  DP_MENU_COLUMN,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_SOUND_LEVEL,
  DP_SOUND_VOICE,
  MENU_COLUMN,
  MENU_HOTKEYS,
  MENU_NAVIGATION_INPUT,
  MENU_PAGE_START,
  MENU_REPEAT_COUNTER,
  MENU_ROW,
  MENU_SELECTION,
  MENU_SHOW_NUMBERS,
  PAD_HELD,
  PAD_PRESSED,
} from '../task/wram.mjs';
import {
  BYTE_BITS,
  BYTE_MASK,
  LONG_MASK,
  WORD_BITS,
  WORD_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

export const MENU_WITH_HOTKEYS = 0x80a6a5,
  MENU_WITH_NUMBERS = 0x80a6ad,
  MENU_WITH_NUMBERS_AT = 0x80a6b8,
  MENU = 0x80a6c7;
// The result (the window before) and the sound effect argument in the direct page.
const DP_RESULT = 0,
  DP_SOUND_EFFECT = 2;
const NONE = WORD_MASK,
  SOUND_LEVEL = 0x40,
  SOUND_VOICES = 3,
  CONFIRM_SOUND = 0x4c,
  MOVE_SOUND = 0x4a,
  REPEAT_DELAY = 0x14,
  REPEAT_AGAIN = 0x13,
  // The pad bits (src/system/joypad.mjs): down, up, both, Y, the confirming B, A, X
  // and Start, and R and L.
  DOWN = 0x400,
  UP = 0x800,
  VERTICAL = 0xc00,
  CANCEL = 0x2000,
  CONFIRM = 0xd0c0,
  PAGE_BACK = 0x20,
  PAGE_FORWARD = 0x10;
// The original's call sites.
const SITES = Object.freeze({
  list: 0x80a6e0,
  mark: 0x80a6e6,
  wait: 0x80a6e9,
  pad: 0x80a6ed,
  pageRequest: 0x80a7f7,
  pageList: 0x80a7fa,
  moveUnmark: 0x80a78e,
  moveMark: 0x80a795,
  hotkeyUnmark: 0x80a7d1,
  confirmUnmark: 0x80a802,
  sound: 0x80a819,
  confirmPad: 0x80a822,
  cancelUnmark: 0x80a829,
  cancelPad: 0x80a831,
});
const WAIT = 0x81b0a1,
  PAD = 0x809e1a,
  SOUND = 0x80c46e,
  REQUEST = 0x80fa67,
  LIST = 0x80a617,
  MARK_ROW = 0x80a5f9,
  UNMARK_ROW = 0x80a5db;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const flag = (ctx, bit, set) => {
  ctx.status = set ? ctx.status | bit : ctx.status & ~bit;
};
const signAndZero = (ctx, value) => {
  flag(ctx, FLAG_NEGATIVE, value & WORD_SIGN);
  flag(ctx, FLAG_ZERO, value === 0);
};

// Choose from the menu list (entry one of the four above), a sequence for a native call
// continuation, called with JSR: routines the table with 81:B0A1, 80:9E1A, 80:C46E and
// 80:FB39.
export function* chooseFromMenuSequence(h, events, routines, entry) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  const field = (at) => word(wram, at),
    store = (at, value) => setWord(wram, at, value),
    longWord = (at) => mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS),
    // The list's texts at the long pointer, the hotkey words through the data bank.
    token = () =>
      longWord((field(DP_LIST_TOKENS) | (wram[DP_LIST_TOKEN_BANK] << WORD_BITS)) + ctx.y),
    hotkey = () => longWord(((ctx.bank << WORD_BITS) | field(DP_LIST_VALUES)) + ctx.y);
  const load = (value) => {
      ctx.a = value & WORD_MASK;
      signAndZero(ctx, ctx.a);
    },
    loadY = (value) => {
      ctx.y = value & WORD_MASK;
      signAndZero(ctx, ctx.y);
    },
    // BIT #imm: only the zero flag.
    test = (mask) => {
      flag(ctx, FLAG_ZERO, !(ctx.a & mask));
      return (ctx.a & mask) !== 0;
    },
    // SBC and ADC with the carry chained as the original's.
    subtract = (left, right) => {
      const borrow = ctx.status & FLAG_CARRY ? 0 : 1,
        value = (left - right - borrow) & WORD_MASK;
      flag(ctx, FLAG_CARRY, left - right - borrow >= 0);
      flag(ctx, FLAG_OVERFLOW, (left ^ right) & (left ^ value) & WORD_SIGN);
      load(value);
    },
    add = (left, right) => {
      const sum = left + right + (ctx.status & FLAG_CARRY ? 1 : 0),
        value = sum & WORD_MASK;
      flag(ctx, FLAG_CARRY, sum > WORD_MASK);
      flag(ctx, FLAG_OVERFLOW, ~(left ^ right) & (left ^ value) & WORD_SIGN);
      load(value);
    };
  const helper = (site, target, body) => dialogCallBody(h, site, target, body);
  const list = (site) => helper(site, LIST, () => drawListSequence(h, events, routines)),
    mark = (site) => helper(site, MARK_ROW, () => markRowSequence(h, events, routines, MARK)),
    unmark = (site) => helper(site, UNMARK_ROW, () => markRowSequence(h, events, routines, UNMARK)),
    pad = (site) => dialogCallSequence(h, events, routines, site, PAD);
  let result;
  const rts = function* () {
    yield () => {
      result = h.rts();
    };
    return result;
  };
  // Confirm the selection: the sound, the row in 00, the pad word once more.
  const confirm = function* () {
    yield () => {
      load(NONE);
      store(DP_RESULT, ctx.a);
      load(SOUND_LEVEL);
      store(DP_SOUND_LEVEL, ctx.a);
      load(SOUND_VOICES);
      store(DP_SOUND_VOICE, ctx.a);
      load(CONFIRM_SOUND);
      store(DP_SOUND_EFFECT, ctx.a);
    };
    yield* dialogCallSequence(h, events, routines, SITES.sound, SOUND);
    yield () => {
      const selection = field(MENU_SELECTION);
      flag(ctx, FLAG_CARRY, selection & 1);
      load(selection >>> 1);
      store(DP_RESULT, ctx.a);
    };
    yield* pad(SITES.confirmPad);
    return yield* rts();
  };
  // Move to the row of the word index in Y, with a new page past the page shown.
  const move = function* () {
    let page = false;
    yield () => {
      h.a.pushWord(ctx.y);
      const start = field(MENU_PAGE_START);
      // CPY: the row before the page.
      flag(ctx, FLAG_CARRY, ctx.y >= start);
      signAndZero(ctx, (ctx.y - start) & WORD_MASK);
      let back = !(ctx.status & FLAG_CARRY),
        forward = false;
      if (!back) {
        load(ctx.y);
        flag(ctx, FLAG_CARRY, true);
        subtract(ctx.a, start);
        flag(ctx, FLAG_CARRY, ctx.a & 1);
        load(ctx.a >>> 1);
        const rows = field(DP_MENU_VISIBLE_ROWS);
        flag(ctx, FLAG_CARRY, ctx.a >= rows);
        signAndZero(ctx, (ctx.a - rows) & WORD_MASK);
        forward = (ctx.status & FLAG_CARRY) !== 0;
      }
      page = back || forward;
      if (!page) return loadY(field(MENU_SELECTION));
      load(start);
      const rows = field(DP_MENU_VISIBLE_ROWS);
      if (forward) {
        flag(ctx, FLAG_CARRY, false);
        add(ctx.a, rows);
        add(ctx.a, rows);
      } else {
        flag(ctx, FLAG_CARRY, true);
        subtract(ctx.a, rows);
        subtract(ctx.a, rows);
        if (!(ctx.status & FLAG_CARRY)) load(0);
      }
      store(MENU_PAGE_START, ctx.a);
    };
    if (page) {
      yield* helper(SITES.pageRequest, REQUEST, () => requestTileClearSequence(h, events));
      yield* list(SITES.pageList);
    } else yield* unmark(SITES.moveUnmark);
    yield () => {
      loadY(h.a.pullWord());
      store(MENU_SELECTION, ctx.y);
    };
    yield* mark(SITES.moveMark);
    yield () => {
      // PEI 00, PEI 06, the move sound's arguments, PLA, PLA.
      const first = field(DP_RESULT),
        rows = field(DP_MENU_VISIBLE_ROWS);
      h.a.pushWord(first);
      h.a.pushWord(rows);
      load(NONE);
      store(DP_RESULT, ctx.a);
      load(SOUND_LEVEL);
      store(DP_SOUND_LEVEL, ctx.a);
      load(SOUND_VOICES);
      store(DP_SOUND_VOICE, ctx.a);
      load(MOVE_SOUND);
      store(DP_SOUND_EFFECT, ctx.a);
      load(h.a.pullWord());
      store(DP_MENU_VISIBLE_ROWS, ctx.a);
      load(h.a.pullWord());
      store(DP_RESULT, ctx.a);
    };
  };
  // The move a newly pressed button asks for, if any (Y the row's word index).
  const navigate = () => {
    load(field(MENU_NAVIGATION_INPUT));
    if (test(DOWN)) {
      loadY(field(MENU_SELECTION) + 2);
      load(token());
      return ctx.a !== 0;
    }
    if (test(UP)) {
      loadY(field(MENU_SELECTION));
      if (!ctx.y) return false;
      loadY(ctx.y - 2);
      return true;
    }
    load(field(MENU_HOTKEYS));
    if (ctx.a) return false;
    load(field(PAD_PRESSED));
    if (test(PAGE_BACK)) {
      load(field(MENU_PAGE_START));
      if (!ctx.a) return false;
      flag(ctx, FLAG_CARRY, true);
      subtract(ctx.a, field(DP_MENU_VISIBLE_ROWS));
      subtract(ctx.a, field(DP_MENU_VISIBLE_ROWS));
      loadY(ctx.a);
      return true;
    }
    if (!test(PAGE_FORWARD)) return false;
    ctx.x = field(DP_MENU_VISIBLE_ROWS);
    signAndZero(ctx, ctx.x);
    loadY(field(MENU_PAGE_START));
    do {
      loadY(ctx.y + 2);
      load(token());
      if (!ctx.a) return false;
      ctx.x = (ctx.x - 1) & WORD_MASK;
      signAndZero(ctx, ctx.x);
    } while (ctx.x);
    return true;
  };

  yield () => {
    if (entry === MENU_WITH_NUMBERS_AT) {
      flag(ctx, FLAG_CARRY, ctx.a & WORD_SIGN);
      load(ctx.a << 1);
      store(MENU_SELECTION, ctx.a);
      load(NONE);
      store(MENU_SHOW_NUMBERS, ctx.a);
      store(MENU_HOTKEYS, 0);
    } else if (entry === MENU_WITH_NUMBERS) {
      load(NONE);
      store(MENU_SHOW_NUMBERS, ctx.a);
      store(MENU_HOTKEYS, 0);
      store(MENU_SELECTION, 0);
    } else {
      if (entry === MENU_WITH_HOTKEYS) {
        load(NONE);
        store(MENU_HOTKEYS, ctx.a);
      } else store(MENU_HOTKEYS, 0);
      store(MENU_SHOW_NUMBERS, 0);
      store(MENU_SELECTION, 0);
    }
    load(field(DP_MENU_COLUMN));
    store(MENU_COLUMN, ctx.a);
    load(field(DP_MENU_ROW));
    store(MENU_ROW, ctx.a);
    store(MENU_PAGE_START, 0);
    store(MENU_REPEAT_COUNTER, 0);
  };
  yield* list(SITES.list);
  yield () => loadY(field(MENU_SELECTION));
  yield* mark(SITES.mark);
  for (;;) {
    yield* dialogCallSequence(h, events, routines, SITES.wait, WAIT, true);
    yield* pad(SITES.pad);
    let branch;
    yield () => {
      load(field(PAD_PRESSED));
      store(MENU_NAVIGATION_INPUT, ctx.a);
      load(field(PAD_HELD) & VERTICAL);
      if (ctx.a) {
        const count = (field(MENU_REPEAT_COUNTER) + 1) & WORD_MASK;
        store(MENU_REPEAT_COUNTER, count);
        load(count);
        flag(ctx, FLAG_CARRY, count >= REPEAT_DELAY);
        signAndZero(ctx, (count - REPEAT_DELAY) & WORD_MASK);
        if (count === REPEAT_DELAY) {
          load(REPEAT_AGAIN);
          store(MENU_REPEAT_COUNTER, ctx.a);
          load(field(PAD_HELD));
          store(MENU_NAVIGATION_INPUT, ctx.a);
        }
      } else store(MENU_REPEAT_COUNTER, 0);
      load(field(PAD_PRESSED));
      if (test(CANCEL)) branch = 'cancel';
      else if (test(CONFIRM)) branch = 'confirm';
      else return void (branch = 'navigate');
      loadY(field(MENU_SELECTION));
    };
    if (branch === 'cancel') {
      yield* unmark(SITES.cancelUnmark);
      yield () => {
        load(NONE);
        store(DP_RESULT, ctx.a);
      };
      yield* pad(SITES.cancelPad);
      return yield* rts();
    }
    if (branch === 'confirm') {
      yield* unmark(SITES.confirmUnmark);
      return yield* confirm();
    }
    let moving = false;
    yield () => {
      moving = navigate();
    };
    if (moving) yield* move();
    let hotkeys = false;
    yield () => {
      load(field(MENU_HOTKEYS));
      hotkeys = ctx.a !== 0;
      if (hotkeys) loadY(0);
    };
    if (!hotkeys) continue;
    for (;;) {
      let end = false,
        hit = false;
      yield () => {
        load(token());
        end = ctx.a === 0;
        if (end) return;
        load(hotkey() & field(PAD_PRESSED));
        hit = ctx.a !== 0;
        if (hit) {
          h.a.pushWord(ctx.y);
          loadY(field(MENU_SELECTION));
        } else loadY(ctx.y + 2);
      };
      if (end) break;
      if (hit) {
        yield* unmark(SITES.hotkeyUnmark);
        yield () => {
          load(h.a.pullWord());
          store(MENU_SELECTION, ctx.a);
        };
        return yield* confirm();
      }
    }
  }
}
