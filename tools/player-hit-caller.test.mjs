import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { compareRun } from './member-menu-caller-harness.mjs';
import { hitObjectJsr as liftedHit } from './register-forms/jsr-forms.mjs';
import * as W from '../src/data/wram.mjs';
import * as V from '../src/vm/layout.mjs';

useLiftVectors(import.meta.url);

// The lifted hit takes the damage, target and shooter as parameters (A, X and Y in the
// original; user decision 2026-11-17), here from the registers the scenario sets.
const hitObjectSequence = (h, events, render) =>
  liftedHit(h, events, render, h.ctx.a, h.ctx.x, h.ctx.y);

function runHit(sequence, player, armour, count, request, free, budget) {
  return compareRun(
    sequence,
    sequence === hitObjectSequence,
    ({ h, put, mem }) => {
      Object.assign(h.ctx, { a: 1, x: 2, y: 0xffff });
      put(W.PLAYER_OBJECT, player ? 2 : 4);
      put(W.OBJECT_FLAGS + 2, W.OBJECT_DAMAGEABLE);
      put(W.OBJECT_ARMOUR + 2, armour);
      put(W.OBJECT_RECORD + 2, 0x3000);
      put(W.OBJECT_TASK + 2, 6);
      mem.wram[W.RECORD_COUNT + 0x3000] = count;
      put(W.TEXT_MAP_UPLOAD, request);
      if (free) {
        put(W.OBJECT_KIND + W.OBJECT_LAST_SLOT, 0xffff);
        put(V.TASK_FREE_LIST, 0);
        put(V.TASK_NEXT, 0xffff);
        put(V.TASK_LIST_HEAD, 0xffff);
        put(V.HEAP_SIZE_WORD, 0x400);
        put(V.HEAP_NEXT_WORD, 0);
      }
    },
    budget,
    [],
    true,
    () => {},
  );
}

for (const budget of [1, 7])
  for (const player of [false, true])
    for (const armour of [0, 1, 2, 0x81])
      for (const count of [0, 1, 2])
        for (const request of [0, 0xfffe, 0xffff])
          for (const free of [false, true])
            test(`actual player hit: player ${player}, armour ${armour}, count ${count}, request ${request}, free ${free}, budget ${budget}`, () => {
              const actual = runHit(
                hitObjectSequence,
                player,
                armour,
                count,
                request,
                free,
                budget,
              );
              assertFrozenRun(actual);
              const word = (at) => actual.wram[at] | (actual.wram[at + 1] << 8);
              assert.equal(word(W.PLAYER_HIT_FRAMES), player ? 11 : 0);
              assert.equal(actual.uploads.length > 0, player && request !== 0xffff);
              const damage = (1 - armour) & 0xff;
              assert.equal(
                actual.wram[W.RECORD_COUNT + 0x3000],
                damage > 0 && damage < 0x80 ? Math.max(0, count - damage) : count,
              );
            });
