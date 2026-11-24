import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { hitObjectsInBlastSequence } from '../src/game/object-blast.mjs';
import { hitObjectsInBlastSequence as formerBlast } from '../proof/caller/object-blast.mjs';
import { hitObjectSequence as formerHit } from '../proof/caller/object-hit.mjs';
import { runDrawWindowList } from '../proof/caller/window-list.mjs';
import * as W from '../src/data/wram.mjs';
import * as V from '../src/vm/layout.mjs';

function runBlast(sequence, axis, distance, hits, player, request, budget) {
  const reached = distance === 0x5f || distance === -0x5f;
  const count = (reached ? 1 : 0) + (player ? 0 : 1);
  const notice = Array.from({ length: count }, (_, n) => ((hits + n) % 8) + 1).some(
    (n) => n === 4 || n === 8,
  );
  return compareRun(
    sequence,
    sequence === hitObjectsInBlastSequence,
    ({ put, mem }) => {
      put(0, 0);
      put(2, 1);
      for (const field of [W.OBJECT_X, W.OBJECT_Y, W.OBJECT_HEIGHT])
        for (const slot of [0, 2, 4]) put(field + slot, 0x500);
      put(axis + 2, 0x500 + distance);
      put(W.OBJECT_FLAGS + 2, W.OBJECT_HITTABLE);
      put(W.OBJECT_FLAGS + 4, W.OBJECT_HITTABLE | (player ? W.OBJECT_DAMAGEABLE : 0));
      put(W.PLAYER_OBJECT, player ? 4 : 0xffff);
      put(W.OBJECT_RECORD + 4, 0x3000);
      put(W.OBJECT_TASK + 4, 6);
      mem.wram[W.RECORD_COUNT + 0x3000] = 2;
      put(W.HARMLESS_HITS, hits);
      put(W.KARMA, 8);
      put(W.TEXT_MAP_UPLOAD, request);
      put(W.OBJECT_KIND + W.OBJECT_LAST_SLOT, 0xffff);
      put(V.TASK_FREE_LIST, 0);
      put(V.TASK_NEXT, 0xffff);
      put(V.TASK_LIST_HEAD, 0xffff);
      put(V.HEAP_SIZE_WORD, 0x400);
      put(V.HEAP_NEXT_WORD, 0);
    },
    budget,
    notice ? [0, 0x8000] : [],
    true,
    ({ h, mem, put, events, routines, bind, calls }) => {
      bind(0x808691, () => formerHit(h, events, routines));
      routines.set(0x81ad92, runDrawWindowList);
      const service = events.interrupts.textWait;
      let noticeWaits = 0;
      events.interrupts.textWait = (callee, frameEvents, status, pc) => {
        // A notice delays thirty counter changes before its first pad read.
        if (notice && pc === 0x81b0a9 && noticeWaits < 30) {
          noticeWaits++;
          // Game state only (user decision 2026-11-17): no X (the original's wait count).
          calls.push(['notice count']);
          put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
          return true;
        }
        return service(callee, frameEvents, status, pc);
      };
    },
  );
}

for (const budget of [1, 7])
  for (const axis of [W.OBJECT_X, W.OBJECT_Y, W.OBJECT_HEIGHT])
    for (const distance of [0x5f, 0x60, -0x5f, -0x60])
      for (const hits of [2, 3, 6, 7])
        for (const player of [false, true])
          for (const request of [0, 0xffff])
            test(`blast actual hits: axis ${axis}, distance ${distance}, hits ${hits}, player ${player}, request ${request}, budget ${budget}`, () => {
              const got = runBlast(
                hitObjectsInBlastSequence,
                axis,
                distance,
                hits,
                player,
                request,
                budget,
              );
              assert.deepEqual(
                got,
                runBlast(formerBlast, axis, distance, hits, player, request, budget),
              );
              if (player) {
                assert.equal(got.wram[W.PLAYER_HIT_FRAMES], 11);
                assert.equal(got.wram[W.RECORD_COUNT + 0x3000], 1);
                assert.equal(got.wram[W.OBJECT_KIND + W.OBJECT_LAST_SLOT], 0xa1);
              }
            });
