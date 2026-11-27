import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The equipment rows of the status window (lifted from 80:E9C5 with its item text
// 80:E9A8; register-level version in proof/replay/native-member-spell-menu.mjs).
//
// In the status window (1F4C) the leader's selected spell name goes to row 14 (column
// 0A). The shown runner's entry (7E:3C2E + 4 x its index 1F60) gives the weapon's name
// in row 15 and in row 16 the armour rating (+2 for the leader with dermal armour,
// 7E:3C18) and the armour's name; each row is first blanked. An item's name is "none"
// for a negative number, otherwise the kind of 8D:B022 by item, six bytes a kind in
// 8C:EFB0. The cursor (80:FAAC), text (80:FE69) and number (80:FD80) run through their
// original frames with direct composition.
//
// Registers (user decision 2026-11-17): game state only; no callee takes a register
// input and no register values are left. Armour, rating and weapon, which the original
// keeps on the stack over the rows (PHA, PLA), are locals.
import { segmentSequence } from '../system/sequence-runner.mjs';
import { setTextCursor, printNumber } from './window-text.mjs';
import { printText } from './text-print.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { dataBankWord } from '../system/data-bank.mjs';
import {
  DP_SCRATCH,
  STATUS_LAYOUT,
  TEXT_BLANK_FIELD,
  TEXT_NONE,
} from '../data/native-member-spell-menu.mjs';
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
} from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// The items' kinds (by item number) and the kinds' name texts (six bytes a kind); the
// runner entry's size and the leader's dermal armour bonus.
const ITEM_KINDS = 0x8db022,
  KIND_NAMES = 0x8cefb0,
  ENTRY_SHIFT = 2,
  DERMAL_ARMOUR_BONUS = 2;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const longWord = (mem, at) =>
  mem.read8(at & LONG_MASK) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);

// 80:E9A8: the item's name as text (the original takes the item in A), without the
// JSR frame of the equipment rows (its return word lies only in free stack bytes).
function* itemText(h, events, renderBuffer, item) {
  const { mem } = h.a,
    { wram } = mem;
  yield () => {
    let text = TEXT_NONE;
    if (!(item & WORD_SIGN)) {
      const kind = longWord(mem, ITEM_KINDS + item),
        twice = (kind << 1) & WORD_MASK,
        // Six times: twice, then four times that added with the shift's carry.
        four = (twice << 1) & WORD_MASK,
        index = (four + twice + (twice & WORD_SIGN ? 1 : 0)) & WORD_MASK;
      setWord(wram, DP_SCRATCH, twice);
      text = longWord(mem, KIND_NAMES + index);
    }
    setWord(wram, 2, text);
  };
  yield* printText(h, events, renderBuffer);
}

// 80:E9C5: the equipment rows (see above) for lifted callers, without the JSR frame.
export function* equipmentRows(h, events, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem;
  const leader = () => dataBankWord(mem, MEMBER_OBJECT) === dataBankWord(mem, PLAYER_OBJECT);
  // The cursor at the value column of row.
  const cursor = function* (row) {
    yield () => {
      setWord(wram, 2, STATUS_LAYOUT.valueColumn);
      setWord(wram, DP_CURSOR_ROW, row);
    };
    yield* segmentSequence(() => setTextCursor(h));
  };
  const text = function* (value) {
    yield () => setWord(wram, 2, typeof value === 'function' ? value() : value);
    yield* printText(h, events, renderBuffer);
  };
  let isLeader;
  yield () => {
    setWord(wram, 0, dataBankWord(mem, STATUS_WINDOW));
    isLeader = leader();
  };
  if (isLeader) {
    yield* cursor(STATUS_LAYOUT.spellRow);
    yield* text(() => word(wram, SELECTED_SPELL_NAME));
  }
  yield* cursor(STATUS_LAYOUT.weaponRow);
  // Armour, rating and weapon are read before the rows (the original pushes them).
  let armour, rating, weapon;
  yield () => {
    const entry = (dataBankWord(mem, MEMBER_INDEX) << ENTRY_SHIFT) & WORD_MASK;
    armour = word(wram, RUNNER_ARMOUR + entry);
    rating = word(wram, RUNNER_ARMOUR_RATING + entry);
    if (leader() && readStateByte(wram, JAKE_DERMAL_ARMOUR)) rating += DERMAL_ARMOUR_BONUS;
    rating &= BYTE_MASK;
    weapon = word(wram, RUNNER_WEAPON + entry);
  };
  yield* text(TEXT_BLANK_FIELD);
  yield* cursor(STATUS_LAYOUT.weaponRow);
  yield* itemText(h, events, renderBuffer, weapon);
  yield* cursor(STATUS_LAYOUT.armourRow);
  yield* text(TEXT_BLANK_FIELD);
  yield* cursor(STATUS_LAYOUT.armourRow);
  yield () => setWord(wram, 2, rating);
  yield* printNumber(h, events, renderBuffer);
  yield* itemText(h, events, renderBuffer, armour);
}
