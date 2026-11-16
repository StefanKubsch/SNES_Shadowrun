import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { spendMagicPointsSequence as directMagic } from '../src/game/magic-points.mjs';
import { spendMagicPointsSequence as formerMagic } from '../proof/caller/magic-points.mjs';
import { showNoticeSequence } from '../proof/caller/notice-show.mjs';
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
