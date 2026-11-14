// The group members as scripts ask about them (lifted from the script native 80:A297;
// register-level reference in proof/game-reference/group-members.mjs).
//
// The group's last word index lies at 7E:2DE6 (negative: empty), the members' object slots
// at 7E:1FA8 (through the data bank 80) and their formation positions at 7E:2DF8, both
// indexed by the member's word index.
import { dataBankWord } from '../system/data-bank.mjs';
import { GROUP_INDEX, GROUP_POSITIONS, GROUP_SLOTS, WRAM } from '../task/wram.mjs';
import { LONG_MASK, WORD_SIGN } from '../constants/bits.mjs';

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
