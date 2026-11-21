import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import * as direct from '../src/game/glove-target.mjs';
import * as former from '../proof/caller/glove-target.mjs';
import { gloveMoveSequence } from '../proof/caller/glove-move.mjs';
import { showNoticeSequence } from '../proof/caller/notice-show.mjs';
import {
  runDrawWindowList,
  runRequestUpload,
  runUnpackWindowMap,
} from '../proof/caller/window-list.mjs';
import * as W from '../src/data/wram.mjs';

function runChoice(module, name, budget, target, pads, request = 0, far = false) {
  return compareRun(
    (h, events, renderer) => module[name](h, events, renderer),
    module === direct,
    ({ put }) => {
      put(W.PLAYER_OBJECT, 0);
      put(0, 4);
      for (const slot of [0, 2, 4]) {
        put(W.OBJECT_X + slot, 0x500);
        put(W.OBJECT_DIAGONAL + slot, 0xa00);
      }
      put(W.OBJECT_HEIGHT + 2, far ? 0x81 : 0);
      put(W.OBJECT_DIAGONAL + 2, far ? 0x97f : 0xa00);
      put(W.GLOVE_TARGET_TAG, 0xffff);
      put(W.GLOVE_NAME_WINDOW, 0xffff);
      put(W.DRAW_LIST_INDEX, target ? 0 : 0xffff);
      put(W.DRAW_LIST, 2);
      put(W.OBJECT_ACTION_DIRECTIONS + 2, 1);
      put(W.OBJECT_KIND + 2, 0);
      put(W.OBJECT_FLAGS + 2, 0x8000);
      put(W.OBJECT_NUMBER + 2, 0x1234);
      put(W.OBJECT_BOX_X2 + 2, 16);
      put(W.OBJECT_BOX_HEIGHT + 2, 16);
      put(W.TEXT_MAP_UPLOAD, request);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    pads,
    true,
    ({ h, events, routines, bind, mem, calls }) => {
      if (module === direct) events.frameJobs = () => assert.fail('fixture services every wait');
      bind(0x80be6d, () => gloveMoveSequence(h, events, routines));
      routines.set(0x81ad92, runDrawWindowList);
      routines.set(0x81a9b2, runUnpackWindowMap);
      routines.set(0x81acb5, runRequestUpload);
      bind(0x80fec1, () => showNoticeSequence(h, events, routines));
      const service = events.interrupts.textWait;
      let prepared = false;
      events.interrupts.textWait = (callee, frameEvents, status, pc) => {
        if (
          !prepared &&
          request !== 0xffff &&
          pc === 0x81acb2 &&
          (name === 'spellGloveTargetSequence' || name === 'choosePlaceWithGloveSequence')
        ) {
          prepared = true;
          if (module === direct) {
            assert.equal(h.ctx.s, 0x1c7, 'preparation keeps only the outer native frame');
            assert.equal(h.ctx.programBank, 0x80);
          } else {
            assert.equal(mem.read16(0x7e0000 | (h.ctx.s + 4)), 0xaebf);
            assert.equal(
              mem.read16(0x7e0000 | (h.ctx.s + 7)),
              name === 'spellGloveTargetSequence' ? 0x9bde : 0xc736,
            );
            assert.equal(mem.read8(0x7e0000 | (h.ctx.s + 9)), 0x80);
          }
          calls.push([
            'prepare upload',
            mem.read16(W.WINDOW_FIRST_INDEX),
            mem.read16(W.WINDOW_LAST_INDEX),
          ]);
        }
        return service(callee, frameEvents, status, pc);
      };
    },
  );
}

const choices = [
  'chooseObjectUnderGloveSequence',
  'chooseObjectNumberSequence',
  'scriptChooseObjectNumberSequence',
  'scriptChooseObjectSequence',
  'spellGloveTargetSequence',
  'choosePlaceWithGloveSequence',
];
for (const budget of [1, 7])
  for (const name of choices)
    for (const target of [false, true])
      for (const request of [0, 0xffff])
        for (const pads of [[0x8000], [0, 0x8000], [0x100, 0x200, 0, 0x8000]])
          test(`choice with actual movement: ${name}, target ${target}, request ${request}, pads ${pads}, budget ${budget}`, () => {
            const actual = runChoice(direct, name, budget, target, pads, request);
            assert.deepEqual(actual, runChoice(former, name, budget, target, pads, request));
            assert.equal(actual.input, pads.length);
            assert.equal(actual.wram[W.GLOVE_KIND], 0);
            if (name === 'spellGloveTargetSequence' || name === 'choosePlaceWithGloveSequence')
              assert.deepEqual(
                actual.calls.filter((call) => call[0] === 'prepare upload'),
                request === 0xffff ? [] : [['prepare upload', 0, 0]],
              );
            if (name === 'choosePlaceWithGloveSequence')
              assert.equal(actual.wram[W.MOTION_ACTIVE + 4], 1);
            else
              assert.equal(
                actual.wram[0] | (actual.wram[1] << 8),
                target ? (name.includes('Number') ? 0x1234 : 2) : 0xffff,
              );
            if (target) assert.ok(actual.uploads.length > 0, 'real name and glyph uploads');
          });
for (const budget of [1, 7])
  for (const name of choices.slice(1, 4))
    test(`choice with actual movement rejects far height: ${name}, budget ${budget}`, () => {
      const actual = runChoice(direct, name, budget, true, [0x8000], 0, true);
      assert.deepEqual(actual, runChoice(former, name, budget, true, [0x8000], 0, true));
      assert.equal(actual.wram[0] | (actual.wram[1] << 8), 0xffff);
      assert.ok(actual.uploads.length > 0);
    });
