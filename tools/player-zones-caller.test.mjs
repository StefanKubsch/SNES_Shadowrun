import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { playerZonesSequence } from '../src/game/player-zones.mjs';
import { playerZonesSequence as formerZones } from '../proof/caller/player-zones.mjs';
import { appendScriptTaskCall } from '../src/script/task-api.mjs';
import * as W from '../src/data/wram.mjs';
import * as V from '../src/vm/layout.mjs';

function runZones(sequence, axis, coordinate, count, absent, budget, full = false) {
  return compareRun(
    (h, events) =>
      sequence(h, events, {
        c34a: appendScriptTaskCall,
        a4bf: () => assert.fail('script-only zone fixture cannot change rooms'),
      }),
    false,
    ({ put, mem }) => {
      put(W.PLAYER_OBJECT, absent ? 0xffff : 0);
      for (const field of [W.OBJECT_X, W.OBJECT_Y, W.OBJECT_HEIGHT]) put(field, 0x100);
      put(axis, coordinate * 4);
      put(W.DP_ZONE_LIST, 0x4000);
      mem.wram[W.DP_ZONE_LIST + 2] = 0x7f;
      mem.wram[0x14000] = count;
      for (let n = 0; n < count; n++) {
        const at = 0x14001 + n * 14;
        for (let i = 0; i < 3; i++) {
          put(at + i * 2, 0x3f);
          put(at + 6 + i * 2, 0x41);
        }
        put(at + 12, n ? 0x10f : 0x80);
      }
      mem.wram[0x14001 + count * 14] = 0;
      put(V.TASK_FREE_LIST, full ? 0xffff : 0);
      put(V.TASK_NEXT, 2);
      put(V.TASK_NEXT + 2, 0xffff);
      put(V.TASK_LIST_HEAD, 0xffff);
      put(V.HEAP_SIZE_WORD, 0x700);
      put(V.HEAP_NEXT_WORD, 0);
    },
    budget,
  );
}

for (const budget of [1, 7])
  for (const axis of [W.OBJECT_X, W.OBJECT_Y, W.OBJECT_HEIGHT])
    for (const coordinate of [0x3e, 0x3f, 0x40, 0x41, 0x42])
      for (const count of [0, 1, 2])
        for (const absent of [false, true])
          test(`actual zone task: axis ${axis}, coordinate ${coordinate}, count ${count}, absent ${absent}, budget ${budget}`, () => {
            const actual = runZones(playerZonesSequence, axis, coordinate, count, absent, budget);
            assert.deepEqual(
              actual,
              runZones(formerZones, axis, coordinate, count, absent, budget),
            );
            const triggered = !absent && coordinate >= 0x3f && coordinate <= 0x41;
            const word = (at) => actual.wram[at] | (actual.wram[at + 1] << 8);
            assert.equal(word(V.TASK_LIST_HEAD), triggered && count ? (count - 1) * 2 : 0xffff);
          });

for (const budget of [1, 7])
  test(`zone task allocation failure remains explicit at budget ${budget}`, () => {
    for (const sequence of [playerZonesSequence, formerZones])
      assert.throws(
        () => runZones(sequence, W.OBJECT_X, 0x40, 1, false, budget, true),
        (error) => error.reason === 'task_slot_required',
      );
  });
