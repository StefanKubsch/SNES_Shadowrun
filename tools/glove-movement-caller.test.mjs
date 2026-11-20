import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { gloveMoveJsr, objectSearchJsr } from '../proof/caller/jsr-forms.mjs';
import { objectSearchSequence as formerSearch } from '../proof/caller/object-search.mjs';
import { gloveMoveSequence as formerMove } from '../proof/caller/glove-move.mjs';
import * as W from '../src/data/wram.mjs';

function runSearch(sequence, budget, options = {}) {
  return compareRun(
    sequence === objectSearchJsr || sequence === gloveMoveJsr
      ? (h, events) => sequence(h, events)
      : sequence,
    false,
    ({ put }) => {
      put(W.GLOVE_KIND, options.glove ?? 0xffff);
      put(W.PAD_HELD, (options.held ?? 0) << 8);
      put(W.GLOVE_SPEED_X, options.speed ?? 0);
      put(W.GLOVE_SPEED_Y, options.speed ?? 0);
      put(W.GLOVE_BASE_X, 0x600);
      put(W.GLOVE_BASE_Y, 0xc00);
      put(W.GLOVE_X, options.position ?? 0x3800);
      put(W.GLOVE_Y, options.position ?? 0x7800);
      put(W.DRAW_LIST_INDEX, options.empty ? 0xffff : 0);
      put(W.DRAW_LIST, 2);
      put(W.OBJECT_ACTION_DIRECTIONS + 2, 1);
      put(W.OBJECT_KIND + 2, options.kind ?? 0);
      put(W.OBJECT_X + 2, 0x500);
      put(W.OBJECT_DIAGONAL + 2, 0xa00);
      put(W.OBJECT_BOX_X2 + 2, 16);
      put(W.OBJECT_BOX_HEIGHT + 2, 16);
      put(W.GLOVE_TARGET_TAG, options.marked ? 1 : 0xffff);
      put(W.GLOVE_NAME_WINDOW, options.marked ? 0 : 0xffff);
      put(W.TEXT_MAP_UPLOAD, options.request ?? 0);
    },
    budget,
    [],
    true,
    ({ h }) =>
      (result) => ({
        ...result,
        // Game state only (user decision 2026-11-17): no A, X, Y or flags.
        registers: [h.ctx.s, h.ctx.pc, h.ctx.programBank, h.ctx.bank],
      }),
  );
}
for (const budget of [1, 7])
  for (const kind of [0, 1, 4])
    for (const marked of [false, true])
      for (const request of [0, 0xffff])
        test(`object search actual name window: kind ${kind}, marked ${marked}, request ${request}, budget ${budget}`, () => {
          const options = { kind, marked, request };
          const actual = runSearch(objectSearchJsr, budget, options);
          assert.deepEqual(actual, runSearch(formerSearch, budget, options));
          assert.equal(actual.wram[W.GLOVE_TARGET_OBJECT], 2);
          assert.ok(actual.uploads.length > 0);
        });

for (const budget of [1, 7])
  for (let held = 0; held < 16; held++)
    for (const marked of [false, true])
      test(`actual glove movement: held ${held}, marked ${marked}, budget ${budget}`, () => {
        const options = { held, marked };
        const actual = runSearch(gloveMoveJsr, budget, options);
        assert.deepEqual(actual, runSearch(formerMove, budget, options));
        if (held && marked) assert.equal(actual.wram[W.GLOVE_TARGET_TAG], 0xff);
        if (!held) assert.equal(actual.wram[W.GLOVE_TARGET_OBJECT], 2);
      });
for (const budget of [1, 7])
  for (const [held, speed, position] of [
    [1, 0x2d0, 0xef00],
    [2, 0xfd30, 0x300],
    [4, 0xfd00, 0xce00],
    [8, 0x300, 0x300],
    [5, 0x7fff, 0x7fff],
    [10, 0x8000, 0xffff],
  ])
    for (const glove of [0, 0xffff, 0xfffd])
      test(`glove movement speed and position boundary: ${held}/${speed}/${position}/${glove}, budget ${budget}`, () => {
        const options = { held, speed, position, glove, marked: true };
        assert.deepEqual(
          runSearch(gloveMoveJsr, budget, options),
          runSearch(formerMove, budget, options),
        );
      });
