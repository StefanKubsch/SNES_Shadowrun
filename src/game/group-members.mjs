// The group members as scripts ask about them and remove them (lifted from the script
// natives 80:A297 and 80:A2B5; register-level references in
// proof/game-reference/group-members.mjs).
//
// The group's last word index lies at 7E:2DE6 (negative: empty), the members' object slots
// at 7E:1FA8 (through the data bank 80) and their formation positions at 7E:2DF8, both
// indexed by the member's word index; their objects (7E:2DE8) and numbers (7E:2DF0) lie
// in the same order.
import { dataBankWord } from '../system/data-bank.mjs';
import { setDataBankWord } from '../system/data-bank.mjs';
import {
  GROUP_INDEX,
  GROUP_NUMBERS,
  GROUP_OBJECTS,
  GROUP_POSITIONS,
  GROUP_SLOTS,
  WRAM,
} from '../task/wram.mjs';
import { LONG_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';

const MEMBER_BYTES = 2;

// 80:A297: the formation position of the member object, searched from the last member
// down; 0 for an empty group or another object.
export function groupMemberPosition(mem, object) {
  const last = mem.read16(WRAM + GROUP_INDEX);
  if (last & WORD_SIGN) return 0;
  for (let member = last; member >= 0; member -= MEMBER_BYTES)
    if (dataBankWord(mem, GROUP_SLOTS, member) === object)
      return mem.read16((WRAM + GROUP_POSITIONS + member) & LONG_MASK);
  return 0;
}

// 80:A2B5: remove the member object from the group: the entries above it in the object,
// number, position and slot lists move down by one word (at least one entry moves, so
// removing the last member copies the word above it), then the last index drops by one
// entry. An empty group or another object changes nothing.
export function removeGroupMember(mem, object) {
  const last = mem.read16(WRAM + GROUP_INDEX);
  if (last & WORD_SIGN) return;
  let member = last;
  while (dataBankWord(mem, GROUP_SLOTS, member) !== object) {
    member = (member - MEMBER_BYTES) & WORD_MASK;
    if (member & WORD_SIGN) return;
  }
  const at = (list, index) => (WRAM + list + index) & LONG_MASK;
  do {
    for (const list of [GROUP_OBJECTS, GROUP_NUMBERS, GROUP_POSITIONS])
      mem.write16(at(list, member), mem.read16(at(list, member + MEMBER_BYTES)));
    setDataBankWord(
      mem,
      GROUP_SLOTS,
      member,
      dataBankWord(mem, GROUP_SLOTS + MEMBER_BYTES, member),
    );
    member = (member + MEMBER_BYTES) & WORD_MASK;
  } while (member < mem.read16(WRAM + GROUP_INDEX));
  mem.write16(WRAM + GROUP_INDEX, (mem.read16(WRAM + GROUP_INDEX) - MEMBER_BYTES) & WORD_MASK);
}
