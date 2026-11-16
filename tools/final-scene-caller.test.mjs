import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { spendMagicPointsSequence as directMagic } from '../src/game/magic-points.mjs';
import { spendMagicPointsSequence as formerMagic } from '../proof/caller/magic-points.mjs';
import { showNoticeSequence } from '../proof/caller/notice-show.mjs';
import { releaseGloveSequence as directGlove } from '../src/game/glove-release.mjs';
import { releaseGloveSequence as formerGlove } from '../proof/caller/glove-release.mjs';
import { runDrawWindowList } from '../proof/caller/window-list.mjs';
import * as W from '../src/data/wram.mjs';

function runMagic(direct, budget, member, points, cost, glyphs) {
  return compareRun(direct ? directMagic : formerMagic, direct, ({mem, put}) => {
    put(W.MEMBER_INDEX, member * 2);
    mem.wram[W.MAGIC_POINTS + member] = points;
    put(0, cost);
    for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
  }, budget, [], glyphs, ({h, events, routines, bind}) => {
    bind(0x80fec1, () => showNoticeSequence(h, events, routines));
  });
}
for (const budget of [1, 7])
  for (const member of [0, 2])
    for (const [points, cost] of [[0, 0], [255, 255], [254, 255], [1, 0xff01], [0, 0xff01]])
      for (const glyphs of [false, true])
        test(`magic notice actual caller: member ${member}, points ${points}, cost ${cost}, glyphs ${glyphs}, budget ${budget}`, () => {
          const actual = runMagic(true, budget, member, points, cost, glyphs);
          assert.deepEqual(actual, runMagic(false, budget, member, points, cost, glyphs));
          const paid = points >= (cost & 255);
          assert.equal(actual.wram[W.MAGIC_POINTS + member], paid ? points - (cost & 255) : points);
          assert.equal(actual.wram[0] | (actual.wram[1] << 8), paid ? 0xffff : 0);
          assert.equal(actual.uploads.length > 0, !paid);
        });

function runGlove(direct, budget, name, request) {
  let services;
  return compareRun((h, events) => direct ? directGlove(h, events) : formerGlove(h, events, services), true, ({put}) => {
    put(W.DIALOG_WINDOW, 0xffff);
    put(W.GLOVE_KIND, 3);
    put(W.GLOVE_NAME_WINDOW, name ? 0 : 0xffff);
    put(W.GLOVE_TARGET_TAG, name ? 0 : 0xffff);
    put(W.TEXT_MAP_UPLOAD, request);
  }, budget, [], false, ({routines}) => {
    routines.set(0x81ad92, runDrawWindowList);
    services = routines;
  });
}
for (const budget of [1, 7])
  for (const name of [false, true])
    for (const request of [0, 0xfffe, 0xffff])
      test(`script glove release: name ${name}, request ${request}, budget ${budget}`, () => {
        const actual = runGlove(true, budget, name, request);
        assert.deepEqual(actual, runGlove(false, budget, name, request));
        assert.equal(actual.wram[W.DIALOG_WINDOW] | (actual.wram[W.DIALOG_WINDOW + 1] << 8), 0);
        assert.equal(actual.wram[W.GLOVE_KIND], 0);
        assert.equal(actual.wram[W.GLOVE_TARGET_TAG] | (actual.wram[W.GLOVE_TARGET_TAG + 1] << 8), 0xffff);
        assert.equal(actual.wram[W.GLOVE_NAME_WINDOW] | (actual.wram[W.GLOVE_NAME_WINDOW + 1] << 8), name ? 0 : 0xffff);
      });
