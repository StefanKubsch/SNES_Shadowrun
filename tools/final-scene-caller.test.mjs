import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { compareRun } from './member-menu-caller-harness.mjs';
import { spendMagicPointsSequence as directMagic } from '../src/game/magic-points.mjs';
import { showNoticeSequence } from '../proof/caller/notice-show.mjs';
import { releaseGloveSequence as directGlove } from '../src/game/glove-release.mjs';
import { runDrawWindowList } from '../proof/caller/window-list.mjs';
import { removeFromFightListSequence as directFight } from '../src/game/fight-list.mjs';
import { setMusicModeRoutine } from '../proof/caller/audio-routines.mjs';
import * as W from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

function runMagic(budget, member, points, cost, glyphs) {
  return compareRun(
    directMagic,
    true,
    ({ mem, put }) => {
      put(W.MEMBER_INDEX, member * 2);
      mem.wram[W.MAGIC_POINTS + member] = points;
      put(0, cost);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    [],
    glyphs,
    ({ h, events, routines, bind }) => {
      bind(0x80fec1, () => showNoticeSequence(h, events, routines));
    },
  );
}
for (const budget of [1, 7])
  for (const member of [0, 2])
    for (const [points, cost] of [
      [0, 0],
      [255, 255],
      [254, 255],
      [1, 0xff01],
      [0, 0xff01],
    ])
      for (const glyphs of [false, true])
        test(`magic notice actual caller: member ${member}, points ${points}, cost ${cost}, glyphs ${glyphs}, budget ${budget}`, () => {
          const actual = runMagic(budget, member, points, cost, glyphs);
          assertFrozenRun(actual);
          const paid = points >= (cost & 255);
          assert.equal(actual.wram[W.MAGIC_POINTS + member], paid ? points - (cost & 255) : points);
          assert.equal(actual.wram[0] | (actual.wram[1] << 8), paid ? 0xffff : 0);
          assert.equal(actual.uploads.length > 0, !paid);
        });

function runGlove(budget, name, request) {
  return compareRun(
    (h, events) => directGlove(h, events),
    true,
    ({ put }) => {
      put(W.DIALOG_WINDOW, 0xffff);
      put(W.GLOVE_KIND, 3);
      put(W.GLOVE_NAME_WINDOW, name ? 0 : 0xffff);
      put(W.GLOVE_TARGET_TAG, name ? 0 : 0xffff);
      put(W.TEXT_MAP_UPLOAD, request);
    },
    budget,
    [],
    false,
    ({ routines }) => {
      routines.set(0x81ad92, runDrawWindowList);
    },
  );
}
for (const budget of [1, 7])
  for (const name of [false, true])
    for (const request of [0, 0xfffe, 0xffff])
      test(`script glove release: name ${name}, request ${request}, budget ${budget}`, () => {
        const actual = runGlove(budget, name, request);
        assertFrozenRun(actual);
        assert.equal(actual.wram[W.DIALOG_WINDOW] | (actual.wram[W.DIALOG_WINDOW + 1] << 8), 0);
        assert.equal(actual.wram[W.GLOVE_KIND], 0);
        assert.equal(
          actual.wram[W.GLOVE_TARGET_TAG] | (actual.wram[W.GLOVE_TARGET_TAG + 1] << 8),
          0xffff,
        );
        assert.equal(
          actual.wram[W.GLOVE_NAME_WINDOW] | (actual.wram[W.GLOVE_NAME_WINDOW + 1] << 8),
          name ? 0 : 0xffff,
        );
      });

function runFight(
  budget,
  karma,
  base,
  variant,
  glyphs,
  options = 0,
  token = 0,
  voices = 0,
  savedMusic = 0,
) {
  return compareRun(
    (h, events, renderer) => directFight(h, events, renderer),
    true,
    ({ put, mem }) => {
      put(0, variant === 'missing' ? 8 : 2);
      put(W.FIGHT_LIST_INDEX, variant === 'remaining' ? 2 : 0);
      put(W.FIGHT_LIST, 2);
      put(W.FIGHT_LIST + 2, 4);
      put(W.FIGHT_FIRST_REMOVAL, 0);
      put(W.GROUP_INDEX, 2);
      put(W.GROUP_LEADER_ONLY, 0);
      put(W.GROUP_POSITIONS, 1);
      put(W.GROUP_POSITIONS + 2, 0);
      put(W.KARMA, karma);
      put(W.FIGHT_KARMA, base);
      put(W.GAME_OPTIONS, options);
      put(W.FIGHT_MUSIC, savedMusic);
      put(W.SOUND_VOICE_MASK, voices);
      put(W.MUSIC, 8);
      mem.wram[W.APU_COMMAND_TOKEN] = token;
      mem.wram.set(
        [0, 1, 2].map((n) => mem.read8(0x98fffa + n)),
        W.AUDIO_DIRECTORY_POINTER,
      );
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    [],
    glyphs,
    ({ h, events, routines, bind }) => {
      bind(0x80fec1, () => showNoticeSequence(h, events, routines));
      routines.set(0x81ef47, setMusicModeRoutine);
    },
  );
}
for (const budget of [1, 7])
  for (const [karma, base] of [
    [0, 0],
    [8, 0],
    [72, 0],
    [80, 0],
    [65535, 0],
    [0, 1],
  ])
    for (const variant of ['missing', 'remaining', 'ended'])
      for (const glyphs of [false, true])
        test(`fight end real caller: karma ${karma}, base ${base}, ${variant}, glyphs ${glyphs}, budget ${budget}`, () => {
          const actual = runFight(budget, karma, base, variant, glyphs);
          assertFrozenRun(actual);
          const gain = ((karma >>> 3) - base) & 65535;
          assert.equal(actual.uploads.length > 0, variant === 'ended' && gain !== 0);
          const index =
            actual.wram[W.FIGHT_LIST_INDEX] | (actual.wram[W.FIGHT_LIST_INDEX + 1] << 8);
          assert.equal(index, variant === 'ended' ? 65534 : 0);
          assert.equal(actual.wram[W.GROUP_POSITIONS], variant === 'missing' ? 1 : 0);
        });

for (const budget of [1, 7])
  for (const token of [254, 255])
    for (const voices of [0, 7])
      test(`fight reward sound: token ${token}, voices ${voices}, budget ${budget}`, () => {
        const actual = runFight(budget, 80, 0, 'ended', true, 0, token, voices);
        assertFrozenRun(actual);
        assert.equal(actual.wram[W.SOUND_VOICE_MASK], 7);
        assert.ok(actual.writes.includes('8514,7,2') === (voices !== 7));
      });

for (const budget of [1, 7])
  for (const options of [0, W.OPTION_MUSIC_RESTORE])
    for (const savedMusic of [0, 1, 255, 65535])
      for (const karma of [0, 80])
        test(`fight music restore: options ${options}, saved ${savedMusic}, karma ${karma}, budget ${budget}`, () => {
          const actual = runFight(budget, karma, 0, 'ended', false, options, 255, 0, savedMusic);
          assertFrozenRun(actual);
          const expected = !options ? 0 : savedMusic === 65535 ? 8 : savedMusic;
          assert.equal(actual.wram[W.MUSIC] | (actual.wram[W.MUSIC + 1] << 8), expected);
          assert.equal(
            actual.writes.filter((write) => write === '8514,8224,2').length,
            options && savedMusic === 65535 ? 0 : 1,
          );
        });
