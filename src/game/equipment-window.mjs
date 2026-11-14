// The equipment rows of the status window (lifted from 80:E9C5 with its item text
// 80:E9A8; register-level version in src/task/native-member-spell-menu.mjs).
//
// In the status window (1F4C) the leader's selected spell name goes to row 14 (column
// 0A). The shown runner's entry (7E:3C2E + 4 x its index 1F60) gives the weapon's name
// in row 15 and in row 16 the armour rating (+2 for the leader with dermal armour,
// 7E:3C18) and the armour's name; each row is first blanked. An item's name is "none"
// for a negative number, otherwise the kind of 8D:B022 by item, six bytes a kind in
// 8C:EFB0. The cursor (80:FAAC), text (80:FE69) and number (80:FD80) run through their
// frames from the routine table.
import { dialogCallBody, nativeCallSequence } from '../task/native-call-continuation.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import {
  DP_SCRATCH,
  STATUS_LAYOUT,
  TEXT_BLANK_FIELD,
  TEXT_NONE,
} from '../task/native-member-spell-menu.mjs';
import {
  DP_CURSOR_ROW,
  JAKE_DERMAL_ARMOUR,
  MEMBER_INDEX,
  MEMBER_OBJECT,
  PLAYER_OBJECT,
  RUNNER_ARMOUR,
  RUNNER_ARMOUR_RATING,
  RUNNER_WEAPON,
  SELECTED_SPELL_NAME,
  STATUS_WINDOW,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_OVERFLOW, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// The items' kinds (by item number) and the kinds' name texts (six bytes a kind); the
// runner entry's size and the leader's dermal armour bonus.
const ITEM_KINDS = 0x8db022,
  KIND_NAMES = 0x8cefb0,
  ENTRY_SHIFT = 2,
  DERMAL_ARMOUR_BONUS = 2;
// The callees and the call sites.
const CURSOR = 0x80faac,
  TEXT = 0x80fe69,
  NUMBER = 0x80fd80,
  ITEM_TEXT = 0x80e9a8,
  ITEM_TEXT_CALL = 0x80e9c1;

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
const call = (h, events, routines, pc, target) =>
  nativeCallSequence(h, events, routines, pc, target, false, false);

// 80:E9A8: the item's name as text (A the item); a sequence that ends with its RTS.
function* itemTextSequence(h, events, routines, item) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  yield () => {
    let text = TEXT_NONE;
    if (!(item & WORD_SIGN)) {
      const kind = longWord(mem, ITEM_KINDS + item),
        twice = (kind << 1) & WORD_MASK,
        // Six times: twice, then four times that added with the shift's carry.
        four = (twice << 1) & WORD_MASK,
        sum = four + twice + (twice & WORD_SIGN ? 1 : 0),
        index = sum & WORD_MASK;
      setWord(wram, DP_SCRATCH, twice);
      setFlag(ctx, FLAG_CARRY, sum > WORD_MASK);
      setFlag(ctx, FLAG_OVERFLOW, (~(four ^ twice) & (four ^ index) & WORD_SIGN) !== 0);
      ctx.x = index;
      text = longWord(mem, KIND_NAMES + index);
    }
    load(ctx, text);
    setWord(wram, 2, text);
  };
  yield* call(h, events, routines, ITEM_TEXT_CALL, TEXT);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// 80:E9C5: the equipment rows (see above). A sequence that ends with its RTS.
export function* equipmentRowsSequence(h, events, routines) {
  const { ctx } = h,
    { mem } = h.a,
    { wram } = mem;
  const leader = () => {
    const member = dataBankWord(mem, MEMBER_OBJECT),
      player = dataBankWord(mem, PLAYER_OBJECT);
    // The compare's carry; its sign and zero are overwritten before any call.
    setFlag(ctx, FLAG_CARRY, member >= player);
    return member === player;
  };
  // The cursor at the value column of row, then a callee at pc.
  const cursor = function* (pc, row) {
    yield () => {
      setWord(wram, 2, STATUS_LAYOUT.valueColumn);
      setWord(wram, DP_CURSOR_ROW, row);
      load(ctx, row);
    };
    yield* call(h, events, routines, pc, CURSOR);
  };
  const text = function* (pc, value) {
    yield () => {
      const v = typeof value === 'function' ? value() : value;
      load(ctx, v);
      setWord(wram, 2, v);
    };
    yield* call(h, events, routines, pc, TEXT);
  };
  const itemText = (pc, item) =>
    dialogCallBody(h, pc, ITEM_TEXT, () => itemTextSequence(h, events, routines, item));
  let isLeader;
  yield () => {
    setWord(wram, 0, dataBankWord(mem, STATUS_WINDOW));
    isLeader = leader();
  };
  if (isLeader) {
    yield* cursor(0x80e9dc, STATUS_LAYOUT.spellRow);
    yield* text(0x80e9e5, () => word(wram, SELECTED_SPELL_NAME));
  }
  yield* cursor(0x80e9f2, STATUS_LAYOUT.weaponRow);
  yield () => {
    const entry = (dataBankWord(mem, MEMBER_INDEX) << ENTRY_SHIFT) & WORD_MASK;
    ctx.x = entry;
    // Armour, rating and weapon stay on the stack over the rows as the original pushes
    // them (PHA): a callee's wait takes its NMI at the same S.
    h.push(word(wram, RUNNER_ARMOUR + entry), 2);
    let value = word(wram, RUNNER_ARMOUR_RATING + entry);
    if (leader() && wram[JAKE_DERMAL_ARMOUR]) {
      const sum = value + DERMAL_ARMOUR_BONUS;
      setFlag(ctx, FLAG_CARRY, sum > WORD_MASK);
      setFlag(ctx, FLAG_OVERFLOW, (~value & sum & WORD_SIGN) !== 0);
      value = sum & WORD_MASK;
    }
    h.push(value & BYTE_MASK, 2);
    h.push(word(wram, RUNNER_WEAPON + entry), 2);
  };
  yield* text(0x80ea2d, TEXT_BLANK_FIELD);
  yield* cursor(0x80ea3a, STATUS_LAYOUT.weaponRow);
  let item;
  yield () => {
    item = h.pull(2);
    load(ctx, item);
  };
  yield* itemText(0x80ea3e, item);
  yield* cursor(0x80ea4b, STATUS_LAYOUT.armourRow);
  yield* text(0x80ea53, TEXT_BLANK_FIELD);
  yield* cursor(0x80ea60, STATUS_LAYOUT.armourRow);
  yield () => {
    const rating = h.pull(2);
    load(ctx, rating);
    setWord(wram, 2, rating);
  };
  yield* call(h, events, routines, 0x80ea66, NUMBER);
  yield () => {
    item = h.pull(2);
    load(ctx, item);
  };
  yield* itemText(0x80ea6a, item);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
