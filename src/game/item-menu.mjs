// The item submenu of the status screen (lifted from 80:E572, 80:E577 and 80:E57F with
// 80:E585, and the item's use 80:E4F3; register-level versions in
// src/task/native-status-screen.mjs).
//
// The entries choose the item class (1F66: 0, 1 or 2). The list after Exit holds every
// actor of the actor table (80:8DB01F, seven bytes each, from the last down) that the
// story stage allows (flags AND 7E:2DE4 AND 7F), that has a state record, whose kind's
// class (8C:EFB4 AND 3) is the chosen one and whose record is held by the shown member
// (1F5A): its kind's name (8C:EFB0), the actor (1E2D) and the record's count (1EAF, 1
// shown as 0). Without items and unless the items open at once (1F64) the submenu
// ends. A window at 0E, 0F (1F50, opened once and kept between rounds) shows the list
// in a numbered menu (80:A6AD). A cancel ends the status screen (7E:1D63 FFFF), Exit
// the submenu; an item is used and, unless the screen ends, the window is redrawn
// (80:FA67) and the list built again. At the end the window is released.
//
// Using an item (80:E4F3) creates its actor's object (80:A835) at a quarter of the
// shown member's position, with the actor's kind, script, record and depth flags, and
// visits its new task at once (80:C1CA, a nested round). Unless that ends the screen,
// the portrait is redrawn if the script asks for it (81:AEB0, 80:E4B3), a key awaited
// while a notice window is open (80:F953, 80:FF79) and the equipment rows redrawn
// (80:E9C5). The callees run through their frames from the routine table.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import {
  DP_ITEM_FLAGS,
  DP_ITEM_LIST_OFFSET,
  DP_ITEM_RECORD,
  ITEM_COUNT_COLUMNS,
  ITEM_WINDOW,
} from '../task/native-status-screen.mjs';
import { DP_SCRATCH } from '../task/native-member-spell-menu.mjs';
import {
  DIALOG_END,
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_LIST_VALUES,
  DP_MENU_COLUMN,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_OBJECT_HEIGHT,
  DP_OBJECT_KIND,
  DP_OBJECT_SCRIPT,
  DP_OBJECT_X,
  DP_OBJECT_Y,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  ITEM_MENU_ACTORS,
  ITEM_MENU_CLASS,
  ITEM_MENU_COUNTS,
  MEMBER_MENU_NAMES,
  MEMBER_NUMBER,
  MEMBER_OBJECT,
  MEMBER_PORTRAIT_REDRAW,
  NOTICE_WINDOW_LAST,
  NOTICE_WINDOWS,
  OBJECT_DEPTH_ORDER,
  OBJECT_HEIGHT,
  OBJECT_NUMBER,
  OBJECT_RECORD,
  OBJECT_X,
  OBJECT_Y,
  STATUS_ITEMS_AT_ONCE,
  STATUS_SUBMENU_WINDOW,
  STORY_STAGE,
} from '../task/wram.mjs';
import {
  ACTOR_BYTES,
  ACTOR_DEPTH_FLAGS,
  ACTOR_KIND,
  ACTOR_RECORD,
  ACTOR_SCRIPT,
  ACTOR_STAGE_FLAGS,
  ACTOR_TABLE,
  LAST_ACTOR,
  STATE_COUNT,
  STATE_HOLDER,
} from '../data/actors.mjs';
import { KIND_ITEM_CLASS_MASK } from '../data/kinds.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { translatedListWindow } from '../data/menu-layout.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// The kinds' names (six bytes a kind) and their class word two bytes on.
const KIND_NAMES = 0x8cefb0,
  KIND_CLASS = 0x8cefb4;
// The entries and their item classes.
export const ITEM_ENTRIES = Object.freeze({ 0x80e572: 0, 0x80e577: 1, 0x80e57f: 2 });
// The callees and their call sites.
const OPEN_WINDOW = [0x80e638, 0x80f963],
  MENU = [0x80e65b, 0x80a6ad],
  USE_ITEM = [0x80e672, 0x80e4f3],
  REDRAW_WINDOW = [0x80e67f, 0x80fa67],
  RELEASE_WINDOW = [0x80e68a, 0x80fa3e],
  CREATE = [0x80e527, 0x80a835],
  VISIT = [0x80e545, 0x80c1ca],
  REDRAW_LIST = [0x80e552, 0x81aeb0],
  PORTRAIT = [0x80e556, 0x80e4b3],
  CONFIRM_KEY = [0x80e568, 0x80f953],
  RELEASE_NOTICES = [0x80e56b, 0x80ff79],
  EQUIPMENT = [0x80e56e, 0x80e9c5];
// The list starts after Exit; a count of one is shown as none; the menu's first column.
const FIRST_ITEM = 2,
  SINGLE = 1,
  MENU_COLUMN = 1,
  CANCELLED = WORD_MASK,
  POSITION_SHIFT = 2;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);
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
const call = (h, events, routines, [pc, target], long = false) =>
  nativeCallSequence(h, events, routines, pc, target, long, false);
function* returnSequence(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
// Six times a kind (twice, then four times that added with the shift's carry), as an
// index into the kinds' table.
function kindIndex(kind) {
  const twice = (kind << 1) & WORD_MASK,
    four = (twice << 1) & WORD_MASK;
  return { twice, index: (four + twice + (twice & WORD_SIGN ? 1 : 0)) & WORD_MASK };
}

// The list of the items of the chosen class held by the shown member; returns the
// offset after the last row. The scratch words DP 02 and 6B keep the last kinds.
function listItems(mem) {
  const { wram } = mem;
  setDataBankWord(mem, MEMBER_MENU_NAMES, 0, TEXT_EXIT);
  setDataBankWord(mem, ITEM_MENU_COUNTS, 0, 0);
  let offset = FIRST_ITEM;
  setWord(wram, DP_ITEM_LIST_OFFSET, offset);
  for (let actor = LAST_ACTOR; actor >= 0; actor -= ACTOR_BYTES) {
    const entry = ACTOR_TABLE + actor;
    // The class and member are read for each actor: a long list overwrites them.
    if (!(longWord(mem, entry) & word(wram, STORY_STAGE) & ACTOR_STAGE_FLAGS)) continue;
    const record = longWord(mem, entry + ACTOR_RECORD);
    if (!record) continue;
    const kind = kindIndex(longWord(mem, entry + ACTOR_KIND));
    setWord(wram, 2, kind.twice);
    const itemClass = longWord(mem, KIND_CLASS + kind.index) & KIND_ITEM_CLASS_MASK;
    if (itemClass !== dataBankWord(mem, ITEM_MENU_CLASS)) continue;
    if (word(wram, STATE_HOLDER + record) !== dataBankWord(mem, MEMBER_NUMBER)) continue;
    const count = wram[STATE_COUNT + record];
    setWord(wram, DP_SCRATCH, kind.twice);
    setDataBankWord(mem, MEMBER_MENU_NAMES, offset, longWord(mem, KIND_NAMES + kind.index));
    setDataBankWord(mem, ITEM_MENU_ACTORS, offset, actor);
    setDataBankWord(mem, ITEM_MENU_COUNTS, offset, count === SINGLE ? 0 : count);
    offset = (offset + 2) & WORD_MASK;
    setWord(wram, DP_ITEM_LIST_OFFSET, offset);
  }
  return offset;
}

// 80:E572, 80:E577 or 80:E57F: the item submenu (see above). A sequence that ends with
// its RTS.
export function* itemMenuSequence(h, events, routines, entry) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  yield () => {
    setDataBankWord(mem, ITEM_MENU_CLASS, 0, ITEM_ENTRIES[entry]);
    setDataBankWord(mem, STATUS_SUBMENU_WINDOW, 0, WORD_MASK);
  };
  for (;;) {
    let empty, open;
    yield () => {
      const offset = listItems(mem);
      // The actor loop ends at actor 0 with the borrow of its last subtraction.
      ctx.y = LAST_ACTOR % ACTOR_BYTES;
      ctx.x = offset;
      setFlag(ctx, FLAG_CARRY, false);
      setFlag(ctx, FLAG_OVERFLOW, false);
      const atOnce = dataBankWord(mem, STATUS_ITEMS_AT_ONCE);
      load(ctx, atOnce);
      if (!atOnce) {
        setFlag(ctx, FLAG_CARRY, offset >= FIRST_ITEM);
        setSignZero(ctx, (offset - FIRST_ITEM) & WORD_MASK);
        empty = offset === FIRST_ITEM;
        if (empty) return;
      }
      setDataBankWord(mem, MEMBER_MENU_NAMES, offset, 0);
      open = negative(dataBankWord(mem, STATUS_SUBMENU_WINDOW));
      if (!open) return;
      let window = ITEM_WINDOW;
      if (mem.language) {
        const ids = [];
        for (let at = 0; at < offset; at += 2) ids.push(dataBankWord(mem, MEMBER_MENU_NAMES, at));
        window = translatedListWindow(mem, ITEM_WINDOW, ids, { valueColumns: ITEM_COUNT_COLUMNS });
      }
      setWord(wram, DP_WINDOW_LEFT, window.left);
      setWord(wram, DP_WINDOW_TOP, window.top);
      setWord(wram, DP_WINDOW_COLUMNS, window.columns);
      setWord(wram, DP_WINDOW_ROWS, window.rows);
      setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
      load(ctx, 0);
    };
    if (empty) return yield* returnSequence(h);
    if (open) {
      yield* call(h, events, routines, OPEN_WINDOW);
      yield () => setDataBankWord(mem, STATUS_SUBMENU_WINDOW, 0, word(wram, 0));
    }
    yield () => {
      setWord(wram, DP_MENU_COLUMN, MENU_COLUMN);
      setWord(wram, DP_MENU_ROW, 0);
      setWord(wram, DP_MENU_VISIBLE_ROWS, ITEM_WINDOW.visibleRows);
      setWord(wram, DP_LIST_TOKENS, MEMBER_MENU_NAMES);
      setWord(wram, DP_LIST_TOKEN_BANK, WRAM_BANK);
      setWord(wram, DP_LIST_VALUES, ITEM_MENU_COUNTS);
      load(ctx, ITEM_MENU_COUNTS);
    };
    yield* call(h, events, routines, MENU);
    let used = false;
    yield () => {
      const row = word(wram, 0);
      ctx.a = row;
      if (row === CANCELLED) {
        setFlag(ctx, FLAG_CARRY, true);
        setDataBankWord(mem, DIALOG_END, 0, row);
        return;
      }
      const index = (row << 1) & WORD_MASK;
      setFlag(ctx, FLAG_CARRY, negative(row));
      load(ctx, index);
      if (!index) return;
      const actor = dataBankWord(mem, ITEM_MENU_ACTORS, index);
      ctx.x = actor;
      load(ctx, actor);
      used = true;
    };
    if (!used) break;
    yield* call(h, events, routines, USE_ITEM);
    let ended;
    yield () => {
      const end = dataBankWord(mem, DIALOG_END);
      load(ctx, end);
      ended = end !== 0;
      if (ended) return;
      const window = dataBankWord(mem, STATUS_SUBMENU_WINDOW);
      load(ctx, window);
      setWord(wram, 0, window);
    };
    if (ended) break;
    yield* call(h, events, routines, REDRAW_WINDOW);
  }
  yield () => {
    const window = dataBankWord(mem, STATUS_SUBMENU_WINDOW);
    load(ctx, window);
    setWord(wram, 0, window);
  };
  yield* call(h, events, routines, RELEASE_WINDOW);
  return yield* returnSequence(h);
}

// 80:E4F3: use the item of the actor X (see above). A sequence that ends with its RTS.
export function* useItemSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem,
    actor = ctx.x;
  yield () => {
    const member = dataBankWord(mem, MEMBER_OBJECT);
    ctx.y = member;
    let carry = 0;
    for (const [field, offset] of [
      [OBJECT_X, DP_OBJECT_X],
      [OBJECT_Y, DP_OBJECT_Y],
      [OBJECT_HEIGHT, DP_OBJECT_HEIGHT],
    ]) {
      const value = dataBankWord(mem, field, member);
      carry = (value >>> 1) & 1;
      setWord(wram, offset, value >>> POSITION_SHIFT);
    }
    const entry = ACTOR_TABLE + actor;
    setWord(wram, DP_ITEM_FLAGS, mem.read8(entry & LONG_MASK));
    setWord(wram, DP_ITEM_RECORD, longWord(mem, entry + ACTOR_RECORD));
    setWord(wram, DP_OBJECT_KIND, longWord(mem, entry + ACTOR_KIND));
    const script = longWord(mem, entry + ACTOR_SCRIPT);
    setWord(wram, DP_OBJECT_SCRIPT, script);
    load(ctx, script);
    setFlag(ctx, FLAG_CARRY, carry);
  };
  yield* call(h, events, routines, CREATE);
  yield () => {
    const slot = word(wram, 0);
    ctx.x = slot;
    setDataBankWord(mem, OBJECT_NUMBER, slot, actor);
    // The depth flags (bits 6 and 7) to bits 15 and 0 of the depth order.
    const flags = word(wram, DP_ITEM_FLAGS) & ACTOR_DEPTH_FLAGS,
      swapped = ((flags << BYTE_BITS) | (flags >>> BYTE_BITS)) & WORD_MASK,
      shifted = swapped << 1,
      shiftCarry = shifted > WORD_MASK ? 1 : 0,
      doubled = shifted & WORD_MASK,
      depth = (doubled + shiftCarry) & WORD_MASK;
    setDataBankWord(mem, OBJECT_DEPTH_ORDER, slot, depth);
    setFlag(ctx, FLAG_CARRY, doubled + shiftCarry > WORD_MASK);
    setFlag(ctx, FLAG_OVERFLOW, !negative(doubled) && negative(depth));
    const record = word(wram, DP_ITEM_RECORD);
    setDataBankWord(mem, OBJECT_RECORD, slot, record);
    setDataBankWord(mem, MEMBER_PORTRAIT_REDRAW, 0, 0);
    load(ctx, record);
  };
  yield* call(h, events, routines, VISIT);
  let ended, redraw;
  yield () => {
    const end = dataBankWord(mem, DIALOG_END);
    load(ctx, end);
    ended = end !== 0;
    if (ended) return;
    redraw = dataBankWord(mem, MEMBER_PORTRAIT_REDRAW);
    load(ctx, redraw);
  };
  if (ended) return yield* returnSequence(h);
  if (redraw) {
    yield* call(h, events, routines, REDRAW_LIST, true);
    yield* call(h, events, routines, PORTRAIT);
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
    // Without a notice window X's sign and zero equal those of the last (negative) load.
    ctx.x = x;
  };
  if (pending) {
    yield* call(h, events, routines, CONFIRM_KEY);
    yield* call(h, events, routines, RELEASE_NOTICES);
  }
  yield* call(h, events, routines, EQUIPMENT);
  return yield* returnSequence(h);
}
