import test from 'node:test';
import assert from 'node:assert/strict';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { actorContent, kindDetails } from '../src/content/actors.mjs';
import { actorRecordState } from '../src/state/actor-records.mjs';
import { memberMenuState } from '../src/state/member-menu.mjs';
import { detachSceneRoom } from '../src/state/scene-room.mjs';
import { detachWindowsText } from '../src/state/windows-text.mjs';
import { detachObjectStorage, setObjectWord, objectWord } from '../src/state/objects.mjs';
import { buildInventoryRows, useItem } from '../src/game/item-menu.mjs';
import { SequenceRunner } from '../src/system/sequence-runner.mjs';
import * as W from '../src/data/wram.mjs';

for (const detached of [false, true]) {
  const memory = () => {
    const mem = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
    if (detached) {
      detachSceneRoom(mem.wram);
      detachWindowsText(mem.wram);
      detachObjectStorage(mem.wram);
    }
    return mem;
  };
  test(`inventory filters stage, class and holder while retaining zero and single counts (${detached ? 'live' : 'fixture'})`, () => {
    const mem = memory(),
      state = memberMenuState(mem),
      actors = actorContent(mem).actors;
    const first = actors.find((actor) => actor.record && actor.flags & 0x20);
    const stage = 0x20,
      itemClass = kindDetails(mem, first.kind).flags & 3,
      matching = actors
        .filter(
          (actor) =>
            actor.record &&
            actor.flags & stage &&
            (kindDetails(mem, actor.kind).flags & 3) === itemClass,
        )
        .slice(0, 4),
      otherClass = actors.find(
        (actor) =>
          actor.record &&
          actor.flags & stage &&
          (kindDetails(mem, actor.kind).flags & 3) !== itemClass,
      ),
      otherStage = actors.find(
        (actor) =>
          actor.record &&
          !(actor.flags & stage) &&
          (kindDetails(mem, actor.kind).flags & 3) === itemClass,
      );
    assert.equal(matching.length, 4);
    assert.ok(otherClass && otherStage);
    state.number = 0x8b2;
    state.storyStage = stage;
    state.itemClass = itemClass;
    const counts = [1, 7, 0];
    for (const [index, actor] of matching.slice(0, 3).entries()) {
      const record = actorRecordState(mem, actor.record);
      record.holder = state.number;
      record.count = counts[index];
    }
    for (const actor of [otherClass, otherStage])
      actorRecordState(mem, actor.record).holder = state.number;
    actorRecordState(mem, matching[3].record).holder = state.number + 1;
    assert.equal(buildInventoryRows(mem), 4);
    const expected = matching
      .slice(0, 3)
      .map((actor, index) => ({
        actor: actor.number,
        count: counts[index] === 1 ? 0 : counts[index],
      }))
      .sort((a, b) => b.actor - a.actor);
    assert.deepEqual(
      [1, 2, 3].map((index) => ({
        actor: state.inventoryRow(index).actor,
        count: state.inventoryRow(index).count,
      })),
      expected,
    );
    const record = actorRecordState(mem, matching[0].record);
    record.holder = 0xffff;
    assert.equal(mem.read16(W.WRAM + matching[0].record + 3), 0xffff);
    assert.equal(buildInventoryRows(mem), 3);
  });
  test(`item creation finishes actor fields before visiting its task (${detached ? 'live' : 'fixture'})`, () => {
    const mem = memory(),
      state = memberMenuState(mem),
      actor = actorContent(mem).actors.find((actor) => actor.record && actor.script < 937);
    state.object = 0;
    setObjectWord(mem, 'x', 0, 101);
    setObjectWord(mem, 'y', 0, 205);
    setObjectWord(mem, 'height', 0, 15);
    setObjectWord(mem, 'kind', W.OBJECT_LAST_SLOT, 0x8000);
    let appends = 0,
      visits = 0;
    const a = {
      mem,
      dataBank: 0x80,
      tasks: {
        append(script) {
          assert.equal(script, actor.script);
          appends++;
          return 2;
        },
      },
    };
    const events = {
      headVisit() {
        assert.equal(appends, 1);
        assert.equal(objectWord(mem, 'number', W.OBJECT_LAST_SLOT), actor.number);
        assert.equal(objectWord(mem, 'record', W.OBJECT_LAST_SLOT), actor.record);
        assert.equal(objectWord(mem, 'task', W.OBJECT_LAST_SLOT), 2);
        assert.deepEqual(
          ['x', 'y', 'height'].map((name) => objectWord(mem, name, W.OBJECT_LAST_SLOT)),
          [100, 204, 12],
        );
        visits++;
        state.endWord = 0xffff;
      },
    };
    const runner = new SequenceRunner(useItem({ a }, events, undefined, actor.number));
    for (let steps = 0; !runner.done; steps++) {
      assert.ok(steps < 20);
      runner.run(1);
    }
    assert.equal(visits, 1);
  });
}
