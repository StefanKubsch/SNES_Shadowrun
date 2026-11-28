import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { partyState } from '../src/state/party.mjs';
import { detachCombat } from '../src/state/combat.mjs';
import { detachSceneRoom } from '../src/state/scene-room.mjs';
import { scriptState } from '../src/state/scripts.mjs';
import { savedGameState } from '../src/state/saved-game.mjs';
import { removeGroupMember, groupMemberPosition } from '../src/game/group-members.mjs';
import * as W from '../src/data/wram.mjs';

for (const detached of [false, true]) {
  test(`party records share scripts, saves and removal (${detached ? 'live' : 'fixture'})`, () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present),
      party = partyState(mem);
    if (detached) {
      detachCombat(mem.wram);
      detachSceneRoom(mem.wram);
    }
    party.lastMember = 3;
    for (let n = 0; n < 4; n++) {
      const member = party.member(n);
      member.kind = 100 + n;
      member.number = 200 + n;
      member.position = 300 + n;
      member.slot = n * 2;
    }
    assert.equal(scriptState(mem).party.lastIndex, 6);
    const saved = savedGameState(mem);
    assert.equal(saved.get('combat', 'groupNumbers', 2), 202);
    saved.set('combat', 'groupPositions', 2, 456);
    assert.equal(groupMemberPosition(mem, 4), 456);
    removeGroupMember(mem, 2);
    assert.equal(party.lastMember, 2);
    assert.deepEqual({ ...party.member(1) }, { kind: 102, number: 202, position: 456, slot: 4 });
    const before = { ...party.member(2) };
    removeGroupMember(mem, 42);
    assert.equal(party.lastMember, 2);
    assert.deepEqual({ ...party.member(2) }, before);
    // A full roster's final removal copies the following saved words, including
    // the adjacent column and actor data; that extra copy must not disappear.
    party.lastMember = 3;
    mem.write16(W.WRAM + W.GROUP_POSITIONS + 8, 789);
    mem.write16(W.WRAM + W.GROUP_SLOTS + 8, 987);
    removeGroupMember(mem, 6);
    assert.deepEqual({ ...party.member(3) }, { kind: 200, number: 300, position: 789, slot: 987 });
    party.lastMember = -1;
    assert.equal(scriptState(mem).party.lastIndex, 0xfe);
    assert.equal(groupMemberPosition(mem, 0), 0);
    removeGroupMember(mem, 0);
    assert.equal(party.lastMember, -1);
    // Legacy unaligned accesses cross two independent word entries.
    mem.write16(W.WRAM + W.GROUP_OBJECTS + 1, 0xa537);
    assert.equal(party.member(0.5).kind, 0xa537);
    party.member(0.5).slot = 0x3912;
    assert.equal(mem.read16(W.WRAM + W.GROUP_SLOTS + 1), 0x3912);
    // A missing slot wraps through the low mirror; the long number column does not.
    mem.write16(W.WRAM + W.GROUP_SLOTS - 2, 0x5731);
    mem.write16(W.WRAM + W.GROUP_NUMBERS + 0xfffe, 0x2496);
    assert.equal(party.member(-1).slot, 0x5731);
    assert.equal(party.member(-1).number, 0x2496);
    party.member(-1).slot = 0x7531;
    assert.equal(mem.read16(W.WRAM + W.GROUP_SLOTS - 2), 0x7531);
  });
}
