import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { detachCombat } from '../src/state/combat.mjs';
import { detachSceneRoom } from '../src/state/scene-room.mjs';
import { detachObjectStorage, setObjectWord, objectWord } from '../src/state/objects.mjs';
import { formationState, FORMATION_STEPS } from '../src/state/formation.mjs';
import { partyState } from '../src/state/party.mjs';
import { formationSpacing } from '../src/content/formation.mjs';
import { recordFormationStep, resetFormationTrail } from '../src/game/formation-trail.mjs';
import { placeInFormation } from '../src/game/formation-place.mjs';
import { toWram } from './to-wram.mjs';
import * as W from '../src/data/wram.mjs';

for (const detached of [false, true]) {
  const memory = () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
    if (detached) {
      detachCombat(mem.wram);
      detachSceneRoom(mem.wram);
      detachObjectStorage(mem.wram);
    }
    return mem;
  };
  test(`trail records movement, stops during hits and resets only original fields (${detached ? 'live' : 'fixture'})`, () => {
    const mem = memory(),
      trail = formationState(mem);
    trail.player = 2;
    for (const [field, value] of Object.entries({ x: 100, y: 200, height: 3, direction: 5 }))
      setObjectWord(mem, field, 2, value);
    recordFormationStep(mem);
    assert.equal(trail.head, FORMATION_STEPS - 1);
    assert.deepEqual({ ...trail.step(trail.head) }, { x: 100, y: 200, height: 3, direction: 5 });
    assert.equal(mem.read16(W.WRAM + W.FORMATION_INDEX), 126);
    assert.equal(trail.moving, true);
    recordFormationStep(mem);
    assert.equal(trail.head, 63);
    assert.equal(trail.moving, false);
    trail.hitFrames = 2;
    setObjectWord(mem, 'x', 2, 101);
    recordFormationStep(mem);
    assert.equal(trail.head, 63);
    trail.hitFrames = 0;
    recordFormationStep(mem);
    assert.equal(trail.head, 62);
    assert.equal(trail.step(62).x, 101);
    // An overrun still aliases the adjacent column through the legacy bridge.
    trail.step(64).x = 789;
    assert.equal(trail.step(0).y, 789);
    resetFormationTrail(mem);
    assert.equal(trail.head, 0);
    assert.equal(trail.step(0).x, 0);
    assert.equal(trail.step(0).y, 0);
    assert.equal(trail.step(62).x, 101);
    assert.equal(trail.step(63).direction, 5);
    assert.equal(trail.moving, true);
    for (let i = 0; i < FORMATION_STEPS; i++) assert.equal(trail.step(i).height, 0);
  });
  test(`followers use spacing across the ring and skip unrecorded steps (${detached ? 'live' : 'fixture'})`, () => {
    const mem = memory(),
      trail = formationState(mem),
      party = partyState(mem);
    assert.deepEqual(
      [0, 1, 2, 3].map((i) => formationSpacing(mem, i)),
      [0, 16, 32, 48],
    );
    party.lastMember = 1;
    party.member(1).number = 42;
    setObjectWord(mem, 'number', 2, 42);
    setObjectWord(mem, 'direction', 2, 5);
    trail.head = 63;
    Object.assign(trail.step(15), { x: 100, y: 200, height: 3, direction: 5 });
    for (const moving of [true, false]) {
      trail.moving = moving;
      setObjectWord(mem, 'selection', 2, moving ? 2 : 0);
      mem.write16Bank0(0, 2);
      placeInFormation(mem);
      assert.deepEqual(
        ['x', 'y', 'height'].map((name) => objectWord(mem, name, 2)),
        [100, 200, 3],
      );
      assert.equal(mem.read16Bank0(2), moving ? 2 : 0);
    }
    trail.step(15).height = 0;
    const before = toWram(mem);
    placeInFormation(mem);
    assert.deepEqual(toWram(mem), before);
  });
}
