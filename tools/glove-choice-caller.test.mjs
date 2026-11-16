import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import * as direct from '../src/game/glove-target.mjs';
import * as former from '../proof/caller/glove-target.mjs';
import { showNoticeSequence } from '../proof/caller/notice-show.mjs';
import { runDrawWindowList } from '../proof/caller/window-list.mjs';
import { runUnpackWindowMap, runRequestUpload } from '../src/game/window-list.mjs';
import { closeDialogSequence } from '../src/game/dialog-talk.mjs';
import * as W from '../src/data/wram.mjs';

function runChoice(module, name, budget, target, pads, options = {}) {
  return compareRun(
    module[name],
    false,
    ({ put }) => {
      put(W.PLAYER_OBJECT, 0);
      put(0, 4);
      put(W.GLOVE_NAME_WINDOW, options.name ? 0 : 0xffff);
      put(W.OBJECT_NUMBER + 2, 0x1234);
      put(W.OBJECT_X + 2, options.distance ?? 0);
      put(W.OBJECT_HEIGHT + 2, options.height ?? 0);
      put(W.MEMBER_MENU_ACTIVE, options.menu ? 1 : 0);
      put(W.TEXT_MAP_UPLOAD, options.request ?? 0);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    pads,
    true,
    ({ h, events, put, routines, bind }) => {
      let moves = 0;
      routines.set(0x80be6d, () => {
        moves++;
        put(W.GLOVE_TARGET_TAG, target ? 0 : 0xffff);
        put(W.GLOVE_TARGET_OBJECT, 2);
        put(W.OBJECT_FLAGS + 2, moves <= (options.reject ?? 0) ? 0 : 0x8000);
        h.ctx.a = target ? 0 : 0xffff;
        return h.rts();
      });
      routines.set(0x81ad92, runDrawWindowList);
      routines.set(0x81a9b2, runUnpackWindowMap);
      routines.set(0x81acb5, runRequestUpload);
      bind(0x8092c5, () => closeDialogSequence(h, events));
      bind(0x80fec1, () => showNoticeSequence(h, events, routines));
    },
  );
}

for (const budget of [1, 7])
  for (const target of [false, true])
    for (const pads of [[0x8000], [0, 0x8000], [0, 0, 0x4000]])
      test(`glove choice real frame wait: target ${target}, pads ${pads}, budget ${budget}`, () => {
        const name = 'chooseObjectUnderGloveSequence';
        const actual = runChoice(direct, name, budget, target, pads);
        assert.deepEqual(actual, runChoice(former, name, budget, target, pads));
        assert.equal(actual.input, pads.length);
        assert.equal(actual.wram[0] | (actual.wram[1] << 8), target ? 2 : 0xffff);
      });

for (const budget of [1, 7])
  for (const pads of [[0x8000], [0x4000], [0x80], [0x40], [0x800f, 0, 0x8000]])
    test(`glove choice real input: pads ${pads}, budget ${budget}`, () => {
      const name = 'chooseObjectUnderGloveSequence';
      const actual = runChoice(direct, name, budget, true, pads);
      assert.deepEqual(actual, runChoice(former, name, budget, true, pads));
      assert.equal(actual.input, pads.length);
      assert.equal(actual.wram[W.PAD_PRESSED] | (actual.wram[W.PAD_PRESSED + 1] << 8), 0);
    });
for (const module of [direct, former])
  test(`glove choice preserves reset boundary: ${module === direct ? 'direct' : 'former'}`, () => {
    assert.throws(
      () => runChoice(module, 'chooseObjectUnderGloveSequence', 1, true, [0x3030]),
      (error) => error.reason === 'task_reset_source_required',
    );
  });

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
        test(`glove choice real release: ${name}, target ${target}, request ${request}, budget ${budget}`, () => {
          const options = { name: true, request };
          const actual = runChoice(direct, name, budget, target, [0x8000], options);
          assert.deepEqual(actual, runChoice(former, name, budget, target, [0x8000], options));
          assert.equal(actual.wram[W.GLOVE_KIND] | (actual.wram[W.GLOVE_KIND + 1] << 8), 0);
          assert.equal(
            actual.wram[W.SCRIPT_GLOVE_CHOICE] | (actual.wram[W.SCRIPT_GLOVE_CHOICE + 1] << 8),
            0,
          );
          if (name === 'choosePlaceWithGloveSequence')
            assert.equal(actual.wram[W.MOTION_ACTIVE + 4], 1);
          else {
            const result = actual.wram[0] | (actual.wram[1] << 8);
            assert.equal(result, !target ? 0xffff : name.includes('Number') ? 0x1234 : 2);
          }
        });
