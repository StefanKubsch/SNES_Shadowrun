import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { hitObjectJsr as liftedHit } from '../proof/caller/jsr-forms.mjs';
import { hitObjectSequence as formerHit } from '../proof/caller/object-hit.mjs';
import * as W from '../src/data/wram.mjs';

// The lifted hit takes the damage, target and shooter as parameters (A, X and Y in the
// original; user decision 2026-11-17), here from the registers the scenario sets.
const hitObjectSequence = (h, events, render) =>
  liftedHit(h, events, render, h.ctx.a, h.ctx.x, h.ctx.y);

function runHit(sequence, hits, karma, request, budget, pads = [0x8000]) {
  const notice = hits === 3 || (hits === 7 && karma >= 8);
  return compareRun(
    sequence,
    sequence === hitObjectSequence,
    ({ h, put }) => {
      Object.assign(h.ctx, { a: 5, x: 2, y: 0xffff });
      put(W.OBJECT_FLAGS + 2, 0x8000);
      put(W.HARMLESS_HITS, hits);
      put(W.KARMA, karma);
      put(W.TEXT_MAP_UPLOAD, request);
    },
    budget,
    notice ? pads : [],
    true,
    ({ h, mem, put, events, calls }) => {
      const service = events.interrupts.textWait;
      events.interrupts.textWait = (callee, frameEvents, status, pc) => {
        const caller = mem.read16(0x7e0000 | (h.ctx.s + 1));
        if (pc === 0x81b0a9 && (caller === 0x87b2 || caller === 0x87f8)) {
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
  for (const hits of [2, 3, 7, 0xffff])
    for (const karma of [0, 7, 8, 9, 0xffff])
      for (const request of [0, 0xfffe, 0xffff])
        test(`hit notice real caller: hits ${hits}, karma ${karma}, request ${request}, budget ${budget}`, () => {
          const actual = runHit(hitObjectSequence, hits, karma, request, budget);
          assert.deepEqual(actual, runHit(formerHit, hits, karma, request, budget));
          const word = (at) => actual.wram[at] | (actual.wram[at + 1] << 8);
          const notice = hits === 3 || (hits === 7 && karma >= 8);
          assert.equal(word(W.HARMLESS_HITS), hits === 7 ? 0 : (hits + 1) & 0xffff);
          assert.equal(word(W.KARMA), hits === 7 ? Math.max(karma - 8, 0) : karma);
          assert.equal(word(0xb4), hits === 3 || hits === 7 ? 1 : 0);
          assert.equal(actual.input, notice ? 1 : 0);
          assert.deepEqual(
            actual.calls,
            notice ? Array.from({ length: 30 }, () => ['notice count']) : [],
          );
          assert.equal(actual.uploads.length > 0, notice);
        });

for (const budget of [1, 7])
  for (const hits of [3, 7])
    for (const key of [0x8000, 0x4000, 0x2000, 0x80, 0x40])
      test(`hit confirmation: hits ${hits}, key ${key}, budget ${budget}`, () => {
        const pads = [0, 0x100, 0, key];
        const actual = runHit(hitObjectSequence, hits, 8, 0, budget, pads);
        assert.deepEqual(actual, runHit(formerHit, hits, 8, 0, budget, pads));
        assert.equal(actual.input, pads.length);
      });
