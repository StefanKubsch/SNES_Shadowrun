import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { detachCombat } from '../src/state/combat.mjs';
import { detachSceneRoom } from '../src/state/scene-room.mjs';
import { detachObjectStorage, setObjectWord } from '../src/state/objects.mjs';
import { runnerState } from '../src/state/runners.mjs';
import { savedGameState } from '../src/state/saved-game.mjs';
import { runnerContent, defaultEquipment } from '../src/content/runners.mjs';
import { equipWeapon, setItemProperty } from '../src/game/runner-equipment.mjs';
import * as W from '../src/data/wram.mjs';

const memory = () => new VmMemory(cartridge.rom, undefined, null, cartridge.present);
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
