// Scripts find members by object slot. Removal compacts all four member fields;
// removing the final member still copies the following entry before shortening.
import { partyState } from '../state/party.mjs';

export function groupMemberPosition(mem, object) {
  const party = partyState(mem);
  for (let index = party.lastMember; index >= 0; index--)
    if (party.member(index).slot === object) return party.member(index).position;
  return 0;
}

export function removeGroupMember(mem, object) {
  const party = partyState(mem);
  let index = party.lastMember;
  while (index >= 0 && party.member(index).slot !== object) index--;
  if (index < 0) return;
  do {
    const member = party.member(index),
      next = party.member(index + 1);
    member.kind = next.kind;
    member.number = next.number;
    member.position = next.position;
    member.slot = next.slot;
    index++;
  } while (index < party.lastMember);
  party.lastMember--;
}
