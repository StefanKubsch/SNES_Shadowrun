import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { objectSearchSequence } from '../src/game/object-search.mjs';
import { objectSearchSequence as formerSearch } from '../proof/caller/object-search.mjs';
import * as W from '../src/data/wram.mjs';

function runSearch(sequence, budget, options = {}) {
  return compareRun(
    sequence === objectSearchSequence ? (h, events) => sequence(h, events) : sequence,
    false,
    ({ put }) => {
      put(W.GLOVE_KIND, 0xffff);
      put(W.GLOVE_BASE_X, 0x600);
      put(W.GLOVE_BASE_Y, 0xc00);
      put(W.GLOVE_X, 0x3800);
      put(W.GLOVE_Y, 0x7800);
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
  );
}
for (const budget of [1, 7])
  for (const kind of [0, 1, 4])
    for (const marked of [false, true])
      for (const request of [0, 0xffff])
        test(`object search actual name window: kind ${kind}, marked ${marked}, request ${request}, budget ${budget}`, () => {
          const options = { kind, marked, request };
          const actual = runSearch(objectSearchSequence, budget, options);
          assert.deepEqual(actual, runSearch(formerSearch, budget, options));
          assert.equal(actual.wram[W.GLOVE_TARGET_OBJECT], 2);
          assert.ok(actual.uploads.length > 0);
        });
