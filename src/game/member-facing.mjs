// A group member turned to the room's direction (lifted from the script native 80:BBA0
// with 80:D15C; register-level version in src/task/native-selection.mjs).
//
// Byte 2 of the room's 9-byte record (8D:929D) is a direction of eight. The member at
// group index 2 (the second) takes the next direction, the one at index 4 the previous
// one, the others the room's. The member gets that direction's step velocity (the
// tables 80:BBFA for x and 80:BC0A for y), the walking action 2 (80:A985, unless
// selected) and the direction (the turn 80:AAAF, src/game/object-turn.mjs).
import { selectObjectAnimation, turnObject } from './object-turn.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import {
  GROUP_INDEX,
  GROUP_NUMBERS,
  OBJECT_NUMBER,
  OBJECT_VELOCITY_X,
  OBJECT_VELOCITY_Y,
  ROOM,
} from '../task/wram.mjs';
import { BYTE_BITS, BYTE_MASK, LONG_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const ROOM_DIRECTIONS = 0x8d929f,
  // The record index: the room times 8 (ASL thrice, the last one's carry is bit 13)
  // plus the room with that carry.
  ROOM_SHIFT = 3,
  ROOM_CARRY_BIT = 13,
  STEPS_X = 0x80bbfa,
  STEPS_Y = 0x80bc0a,
  SECOND_MEMBER = 2,
  THIRD_MEMBER = 4,
  DIRECTION_MASK = 7,
  WALKING = 2,
  // The return words of 80:D15C's JSRs to 80:A985 and 80:AAAF (the bank offsets of
  // their last bytes).
  SELECTION_RETURN = 0xd162,
  // and of 80:BBA0's JSR to 80:D15C.
  SET_ACTION_RETURN = 0xbbf8,
  TURN_RETURN = 0xd16b;
// The direct page: the object, the action and the direction as 80:D15C takes them, and
// the room's direction the original keeps in A2.
const DP_OBJECT = 0,
  DP_ACTION = 2,
  DP_DIRECTION = 4,
  DP_ROOM_DIRECTION = 0xa2;

const word = (wram, at) => wram[at] | (wram[at + 1] << BYTE_BITS);
const setWord = (wram, at, value) => {
  wram[at] = value & BYTE_MASK;
  wram[at + 1] = (value >>> BYTE_BITS) & BYTE_MASK;
};
const romWord = (mem, at) => mem.read8(at) | (mem.read8((at + 1) & LONG_MASK) << BYTE_BITS);

// The group index of the object number, from the last member down; negative if none.
function memberIndex(wram, number) {
  let index = word(wram, GROUP_INDEX);
  while (word(wram, GROUP_NUMBERS + index) !== number) {
    index = (index - 2) & WORD_MASK;
    if (index & WORD_SIGN) break;
  }
  return index;
}

// 80:BBA0: the member object (the direct page word 00) faces the room's direction; a is
// the accessor whose stack takes the turn's call frame.
export function faceRoomDirection(mem, a) {
  const { wram } = mem,
    object = word(wram, DP_OBJECT),
    room = word(wram, ROOM),
    record =
      (((room << ROOM_SHIFT) & WORD_MASK) + room + ((room >>> ROOM_CARRY_BIT) & 1)) & WORD_MASK,
    roomDirection = mem.read8((ROOM_DIRECTIONS + record) & LONG_MASK);
  setWord(wram, DP_ROOM_DIRECTION, roomDirection);
  const index = memberIndex(wram, dataBankWord(mem, OBJECT_NUMBER, object));
  let direction = roomDirection;
  if (index === SECOND_MEMBER) direction++;
  else if (index === THIRD_MEMBER) direction--;
  direction &= DIRECTION_MASK;
  setWord(wram, DP_DIRECTION, direction);
  const step = direction << 1;
  setDataBankWord(mem, OBJECT_VELOCITY_X, object, romWord(mem, STEPS_X + step));
  setDataBankWord(mem, OBJECT_VELOCITY_Y, object, romWord(mem, STEPS_Y + step));
  setWord(wram, DP_ACTION, WALKING);
  a.pushWord(SET_ACTION_RETURN);
  setActionAndDirection(mem, a);
  a.pullWord();
}

// 80:D15C: the object (the direct page word 00) takes the action selection of word 02
// (80:A985, unless selected) and turns to the direction of word 04 (80:AAAF), which
// the original passes in word 02 with the object restored to word 00.
export function setActionAndDirection(mem, a) {
  // The pushed words and the return words of the JSRs lie on the stack as in the
  // original: a record pointer far out of range reads them through the WRAM mirror.
  const { wram } = mem;
  a.pushWord(word(wram, DP_DIRECTION));
  a.pushWord(word(wram, DP_OBJECT));
  a.pushWord(SELECTION_RETURN);
  selectObjectAnimation(mem, wram);
  a.pullWord();
  setWord(wram, DP_OBJECT, a.pullWord());
  setWord(wram, DP_ACTION, a.pullWord());
  a.pushWord(TURN_RETURN);
  turnObject(mem, wram, a);
  a.pullWord();
}
