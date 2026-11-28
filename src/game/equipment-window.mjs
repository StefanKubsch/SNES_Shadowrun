import { memberMenuState } from '../state/member-menu.mjs';
import { jakeState } from '../state/jake.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
// The selected member's spell, weapon and armour rows. Dermal armour adds two
// to the leader's displayed rating.
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
import { DP_CURSOR_ROW, PLAYER_OBJECT, SELECTED_SPELL_NAME } from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

// The items' kinds (by item number) and the kinds' name texts (six bytes a kind); the
// runner entry's size and the leader's dermal armour bonus.
const ITEM_KINDS = 0x8db022,
  KIND_NAMES = 0x8cefb0,
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
  const leader = () => memberMenuState(mem).object === dataBankWord(mem, PLAYER_OBJECT);
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
    setWord(wram, 0, memberMenuState(mem).window);
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
    const runner = memberMenuState(mem).equipment;
    armour = runner.armour.object;
    rating = runner.armour.rating;
    if (leader() && jakeState(mem).dermalArmour) rating += DERMAL_ARMOUR_BONUS;
    rating &= BYTE_MASK;
    weapon = runner.weapon.object;
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
