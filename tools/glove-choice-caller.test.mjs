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
