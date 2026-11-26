import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT_FIELDS, combatState, detachCombat } from '../src/state/combat.mjs';
import { storageContract, blankMemory, WRAM } from './state-storage-contract.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { toWram } from './to-wram.mjs';
import { appendToFightList, isInFightList } from '../src/game/fight-list.mjs';
import { shakeHitPlayer } from '../src/game/player-hit.mjs';
import { saveGame, slotChecksum } from '../src/game/save-slots.mjs';
import { loadSavedGame } from '../src/game/game-start.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { detachObjectStorage, objectTable } from '../src/state/objects.mjs';
import * as W from '../src/data/wram.mjs';

test('combat fields import, project and restore disjoint independent storage', () => {
  storageContract(COMBAT_FIELDS, detachCombat);
});

test('equipment keeps odd weapon words, row boundaries and saved magic bytes', () => {
  const mem = blankMemory(),
    state = detachCombat(mem.wram);
  mem.write16(WRAM + W.RUNNER_WEAPON + 8, 0x1234);
  assert.equal(state.weapon[1], 0x1234);
  mem.write16(WRAM + W.RUNNER_WEAPON_KIND + 8, 0xabcd);
  assert.equal(state.weaponKind[1], 0xcd);
  assert.equal(state.weaponDamage[1], 0xab);
  mem.write16(WRAM + W.RUNNER_WEAPON_RANGE + 8, 0x5678);
  assert.equal(state.weaponRange[1], 0x78);
  assert.equal(state.armour[2], 0x56);
  mem.write16(WRAM + W.MAGIC_POINTS - 1, 0x9abc);
  assert.equal(state.weaponRange.at(-1), 0xbc);
  assert.equal(state.magic[0], 0x9a);
  assert.equal(mem.wram[W.MAGIC_POINTS], 0);
  mem.write16(0x800000 + W.GLOVE_X + 1, 0x789a);
  assert.equal(state.gloveX[0], 0x9a00);
  assert.equal(state.gloveY[0], 0x78);
});

test('fight list overflow aliases fight music and removal state without a capacity guard', () => {
  const mem = blankMemory(),
    state = detachCombat(mem.wram);
  state.fightIndex[0] = 0xfffe;
  for (let i = 0; i < 13; i++) appendToFightList(mem, {}, 0x20 + i * 2);
  assert.equal(state.fightIndex[0], 24);
  assert.equal(state.fightMusic[0], 0x38);
  assert.equal(isInFightList(mem, 0x38), 65535);
  assert.equal(mem.wram[W.FIGHT_LIST_INDEX], 0);
});

for (const frames of [1, 2, 3])
  test('player hit countdown reads detached combat and object state at frame ' + frames, () => {
    const reference = blankMemory(),
      live = blankMemory();
    reference.write16(W.PLAYER_OBJECT, 2);
    reference.write16(W.PLAYER_HIT_FRAMES, frames);
    live.wram.set(reference.wram);
    detachCombat(live.wram);
    detachObjectStorage(live.wram);
    shakeHitPlayer(reference.wram);
    shakeHitPlayer(live.wram);
    assert.deepEqual(toWram(live), reference.wram);
    assert.equal(live.wram[W.PLAYER_HIT_FRAMES], frames);
    assert.equal(objectTable(live.wram).velocityX[1], frames === 1 ? 0 : frames === 2 ? 4 : 65532);
  });

test('SRAM save and load serialize detached party and equipment bytes with the original checksum', () => {
  const reference = new VmMemory(
      cartridge.rom,
      undefined,
      new Uint8Array(0x2000),
      cartridge.present,
    ),
    live = new VmMemory(cartridge.rom, undefined, new Uint8Array(0x2000), cartridge.present);
  for (let i = W.SAVE_STATE_START; i < 0x3d08; i++) reference.wram[i] = (i * 13 + 7) & 255;
  live.wram.set(reference.wram);
  const state = detachCombat(live.wram);
  for (const [at, value] of [
    [W.GROUP_INDEX, 6],
    [W.RUNNER_WEAPON + 8, 0x1234],
    [W.MAGIC_POINTS, 30],
  ]) {
    reference.write16(WRAM + at, value);
    live.write16(WRAM + at, value);
  }
  saveGame(reference, 0, false);
  saveGame(live, 0, false);
  assert.deepEqual(live.sram, reference.sram);
  assert.equal(slotChecksum(live.sram, 0), live.read16(0x700000));
  state.weapon[1] = 0;
  state.magic[0] = 0;
  loadSavedGame({ mem: reference }, 0);
  loadSavedGame({ mem: live }, 0);
  assert.deepEqual(toWram(live), reference.wram);
  assert.equal(state.weapon[1], 0x1234);
  assert.equal(state.magic[0], 30);
});

test('only the normal live loop detaches combat storage', () => {
  const mem = blankMemory();
  assert.equal(combatState(mem.wram), undefined);
  const game = new LiveGame(cartridge);
  combatState(game.memory.wram).hitFrames[0] = 5;
  assert.equal(game.memory.read16(W.PLAYER_HIT_FRAMES), 5);
  assert.equal(game.memory.wram[W.PLAYER_HIT_FRAMES], 0);
});
