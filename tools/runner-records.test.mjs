import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { detachCombat } from '../src/state/combat.mjs';
import { detachSceneRoom } from '../src/state/scene-room.mjs';
import { detachObjectStorage, setObjectWord } from '../src/state/objects.mjs';
import { runnerState } from '../src/state/runners.mjs';
import { jakeState } from '../src/state/jake.mjs';
import { partyState } from '../src/state/party.mjs';
import { scriptState } from '../src/state/scripts.mjs';
import { setUpNewGameState } from '../src/game/game-start.mjs';
import { raiseStateCount, raiseMagicPoints, runnerStrength } from '../src/game/runner-state.mjs';
import { addMemberMagicPoints } from '../src/game/party-funds.mjs';
import { savedGameState } from '../src/state/saved-game.mjs';
import { runnerContent, defaultEquipment } from '../src/content/runners.mjs';
import { equipWeapon, setItemProperty } from '../src/game/runner-equipment.mjs';
import * as W from '../src/data/wram.mjs';

const memory = () => new VmMemory(cartridge.rom, undefined, null, cartridge.present);
for (const detached of [false, true]) {
  test(`named attributes survive initialization and share resource consumers (${detached ? 'live' : 'fixture'})`, () => {
    const mem = memory(),
      jake = jakeState(mem);
    jake.unidentifiedAttribute = 0xa5;
    if (detached) {
      detachCombat(mem.wram);
      detachSceneRoom(mem.wram);
      detachObjectStorage(mem.wram);
    }
    setUpNewGameState({ mem });
    assert.equal(jake.unidentifiedAttribute, 0xa5);
    assert.equal(jake.body, 3);
    assert.equal(jake.maxHealth, 30);
    assert.equal(runnerState(mem, 0).stats, jake);
    scriptState(mem).jake.leadership = 0x123;
    assert.equal(jake.skills.leadership, 0x23);
    savedGameState(mem).set('scene', 'leaderRecord', 13, 4);
    assert.equal(jake.spells.heal, 4);
    const party = partyState(mem);
    party.lastMember = 0;
    party.member(0).number = runnerContent(mem)[0].object;
    setObjectWord(mem, 'number', 0, party.member(0).number);
    setObjectWord(mem, 'record', 0, 0x33dc);
    mem.write8(W.WRAM + W.RECORD_COUNT + 0x33dc, 25);
    raiseStateCount(mem, 0, 20);
    assert.equal(mem.read8(W.WRAM + W.RECORD_COUNT + 0x33dc), 30);
    jake.magic = 30;
    runnerState(mem, 0).magicPoints = 250;
    raiseMagicPoints(mem, 0, 100);
    // The word maximum is 300; its byte store retains 44.
    assert.equal(runnerState(mem, 0).magicPoints, 44);
    mem.write16(W.WRAM + W.MEMBER_INDEX, 0);
    addMemberMagicPoints(mem, 300);
    assert.equal(runnerState(mem, 0).magicPoints, 88);
    jake.strength = 17;
    mem.write16Bank0(0, 0);
    runnerStrength(mem);
    assert.equal(mem.read16Bank0(0), 17);
    assert.equal(runnerState(mem, 1).stats.maxHealth, runnerContent(mem)[1].stats.maxHealth);
  });
}

for (const detached of [false, true]) {
  test(`runner equipment shares odd words, saved bytes and overflow aliases (${detached ? 'live' : 'fixture'})`, () => {
    const mem = memory();
    if (detached) {
      detachCombat(mem.wram);
      detachSceneRoom(mem.wram);
      detachObjectStorage(mem.wram);
    }
    const runner = runnerState(mem, 2);
    assert.equal(runnerState(mem, 2), runner);
    mem.write16(W.WRAM + W.MEMBER_INDEX, 4);
    setObjectWord(mem, 'number', 0, 0x1234);
    equipWeapon(mem, 0, 0x101, 0x102, -3);
    assert.deepEqual({ ...runner.weapon }, { object: 0x1234, kind: 1, damage: 2, range: 253 });
    assert.equal(mem.read16(W.WRAM + W.RUNNER_WEAPON + 16), 0x1234);
    const saved = savedGameState(mem);
    assert.equal(saved.get('combat', 'weaponRange', 2), 253);
    saved.set('combat', 'weaponDamage', 2, 7);
    assert.equal(runner.weapon.damage, 7);
    // The historical extra unequip row overlaps the first runner's magic points.
    runnerState(mem, 13).armour.object = 0x3412;
    assert.equal(runnerState(mem, 0).magicPoints, 0x12);
    assert.equal(runnerState(mem, 1).magicPoints, 0x34);
  });
}

for (const fixes of [false, true]) {
  test(`unequip preserves the weapon default branch (fixes ${fixes})`, () => {
    const mem = memory();
    detachCombat(mem.wram);
    detachSceneRoom(mem.wram);
    detachObjectStorage(mem.wram);
    setObjectWord(mem, 'number', 0, 0x1234);
    setObjectWord(mem, 'record', 0, 0x2e00);
    const runner = runnerState(mem, 2),
      defaults = runnerContent(mem)[2].weapon;
    runner.weapon.object = 0x1234;
    setItemProperty(mem, 0, 0x5678, fixes);
    assert.equal(mem.read16(W.WRAM + W.RECORD_PROPERTY + 0x2e00), 0x5678);
    assert.deepEqual(
      { ...runner.weapon },
      {
        object: defaults.object,
        kind: (fixes ? defaults.kind : defaults.object) & 255,
        damage: fixes ? defaults.damage : defaults.object >>> 8,
        range: (fixes ? defaults.range : defaults.object) & 255,
      },
    );
  });
}

test('unequip still searches the extra alias row before all regular runners', () => {
  const mem = memory();
  detachCombat(mem.wram);
  detachSceneRoom(mem.wram);
  detachObjectStorage(mem.wram);
  setObjectWord(mem, 'number', 0, 0x1234);
  setObjectWord(mem, 'record', 0, 0x2e00);
  runnerState(mem, 13).armour.object = 0x1234;
  runnerState(mem, 12).armour.object = 0x1234;
  const defaults = defaultEquipment(mem, 13).armour;
  setItemProperty(mem, 0, 1, true);
  assert.deepEqual({ ...runnerState(mem, 13).armour }, defaults);
  assert.equal(runnerState(mem, 12).armour.object, 0x1234);
});
