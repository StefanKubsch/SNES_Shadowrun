import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { playerZonesJsr } from '../proof/caller/jsr-forms.mjs';
import { playerZonesSequence as formerZones } from '../proof/caller/player-zones.mjs';
import { appendScriptTaskCall } from '../proof/caller/task-append-call.mjs';
import { enterRoom } from '../proof/system/main-transition.mjs';
import * as W from '../src/data/wram.mjs';
import * as V from '../src/vm/layout.mjs';

function runZones(sequence, axis, coordinate, count, absent, budget, full = false) {
  return compareRun(
    (h, events) =>
      sequence === playerZonesJsr
        ? sequence(h, events)
        : sequence(h, events, {
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
            const actual = runZones(playerZonesJsr, axis, coordinate, count, absent, budget);
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
    for (const sequence of [playerZonesJsr, formerZones])
      assert.throws(
        () => runZones(sequence, W.OBJECT_X, 0x40, 1, false, budget, true),
        (error) => error.reason === 'task_slot_required',
      );
  });

function runRoomZone(sequence, room, budget) {
  return compareRun(
    (h, events) =>
      sequence === playerZonesJsr
        ? sequence(h, events)
        : sequence(h, events, { c34a: appendScriptTaskCall, a4bf: enterRoom }),
    false,
    ({ put, mem }) => {
      put(W.PLAYER_OBJECT, 0);
      put(W.GLOVE_TARGET_TAG, 0xffff);
      put(W.GROUP_INDEX, 0xffff);
      put(W.FIGHT_LIST_INDEX, 0xfffe);
      put(W.DP_ZONE_LIST, 0x4000);
      mem.wram[W.DP_ZONE_LIST + 2] = 0x7f;
      mem.wram[0x14000] = 0;
      mem.wram[0x14001] = 1;
      for (let n = 0; n < 6; n++) put(0x14002 + n * 2, 0);
      put(0x1400e, room);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
      mem.wram.set(
        [0, 1, 2].map((n) => mem.read8(0x98fffa + n)),
        W.AUDIO_DIRECTORY_POINTER,
      );
    },
    budget,
    [],
    false,
    ({ h, mem, put, events, calls }) => {
      h.ctx.s = 0x1eef;
      const service = events.interrupts.textWait;
      events.interrupts.textWait = (callee, frameEvents, status, pc) => {
        if (pc === 0x81b0a9) {
          const live = sequence === playerZonesJsr;
          assert.equal(mem.read16(0x7e0000 | (h.ctx.s + 1)), live ? 0x1234 : 0x80af);
          if (live) assert.equal(h.ctx.s, 0x1eed, 'room wait preserves the outer caller stack');
          assert.equal(
            h.ctx.programBank,
            0x81,
            'comparison interrupt adapter selects the wait bank',
          );
          calls.push(['room frame', pc]);
          put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
          return true;
        }
        return service(callee, frameEvents, status, pc);
      };
      return (result) => {
        result.wram.fill(0, 0x1e80, 0x1ef0);
        for (const [, payload] of result.uploads) payload.fill(0, 0x1e80 - 0x1cc, 0x1ef0 - 0x1cc);
        return result;
      };
    },
  );
}

for (const budget of [1, 7])
  for (const room of [0, 3, 0xab, 0xd2, 0x159])
    test(`zone enters actual room ${room} at budget ${budget}`, () => {
      const actual = runRoomZone(playerZonesJsr, room, budget);
      assert.deepEqual(actual, runRoomZone(formerZones, room, budget));
      assert.equal(actual.wram[W.ROOM] | (actual.wram[W.ROOM + 1] << 8), room);
      assert.ok(actual.calls.some((call) => call[0] === 'room frame'));
      assert.ok(actual.writes.length > 0);
    });
